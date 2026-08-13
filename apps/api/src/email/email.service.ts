import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { RuntimeConfigService } from '../config/runtime-config.service';

type Transport = 'smtp' | 'resend' | 'console';

/**
 * Sends transactional mail through whichever transport is configured.
 *
 * SMTP wins when SMTP_HOST is set, so any mailbox you already own works.
 * Resend is the fallback. With neither, mail is logged rather than sent —
 * fine locally, a silent lockout in production.
 *
 * Everything resolves through RuntimeConfigService rather than process.env, so
 * keys entered in Admin → API Management take effect without a redeploy.
 *
 * Note for Cloud Run: GCP blocks outbound port 25 outright and usually 465/587
 * as well, so SMTP generally needs a Serverless VPC connector with Cloud NAT.
 * Resend goes over HTTPS and does not.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private smtp: nodemailer.Transporter | null = null;
  private smtpKey = '';
  private resend: Resend | null = null;
  private resendKey = '';

  constructor(private config: RuntimeConfigService) {}

  private async transport(): Promise<{ kind: Transport; smtp?: nodemailer.Transporter; resend?: Resend }> {
    const host = await this.config.get('SMTP_HOST');
    if (host) {
      const port = Number((await this.config.get('SMTP_PORT')) || 587);
      const user = await this.config.get('SMTP_USER');
      const pass = await this.config.get('SMTP_PASSWORD');
      const fingerprint = `${host}:${port}:${user ?? ''}`;
      if (!this.smtp || this.smtpKey !== fingerprint) {
        this.smtp = nodemailer.createTransport({
          host,
          port,
          // 465 is implicit TLS; 587 upgrades via STARTTLS.
          secure: port === 465,
          auth: user ? { user, pass } : undefined,
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
        });
        this.smtpKey = fingerprint;
      }
      return { kind: 'smtp', smtp: this.smtp };
    }

    const key = await this.config.get('RESEND_API_KEY');
    if (key) {
      if (!this.resend || this.resendKey !== key) {
        this.resend = new Resend(key);
        this.resendKey = key;
      }
      return { kind: 'resend', resend: this.resend };
    }

    return { kind: 'console' };
  }

  /** Whether mail can actually be delivered. Not user-specific, so exposing
   *  this leaks nothing about which accounts exist. */
  async isConfigured(): Promise<boolean> {
    return (await this.transport()).kind !== 'console';
  }

  /** Opens and authenticates the connection without sending. */
  async verify(): Promise<{ transport: Transport; ok: boolean; error?: string }> {
    const t = await this.transport();
    if (t.kind === 'console') return { transport: 'console', ok: false, error: 'No transport configured.' };
    if (t.kind === 'smtp') {
      try {
        await t.smtp!.verify();
        return { transport: 'smtp', ok: true };
      } catch (err: any) {
        return { transport: 'smtp', ok: false, error: err?.message ?? String(err) };
      }
    }
    return { transport: 'resend', ok: true };
  }

  private async from(): Promise<string> {
    return (await this.config.get('EMAIL_FROM')) || 'Universal Book <noreply@universal-book.com>';
  }

  private async appUrl(): Promise<string> {
    return (await this.config.get('APP_URL')) || 'https://universal-book.com';
  }

  // ─── Transport ────────────────────────────────────────────────────────────

  /**
   * Never throws. A failed email must not fail the request that triggered it —
   * password reset returns the same response whether or not delivery worked, so
   * the endpoint cannot be used to enumerate registered addresses.
   */
  private async send(to: string, subject: string, html: string): Promise<boolean> {
    try {
      const t = await this.transport();

      if (t.kind === 'console') {
        // Never log the body: these carry single-use reset links, and anyone
        // with log access could redeem one.
        this.logger.warn(
          `No email transport configured — dropping "${subject}" to ${to}. ` +
          'Set SMTP or Resend in Admin → API Management.',
        );
        if (process.env.NODE_ENV !== 'production') {
          this.logger.debug(`[dev] link for ${to}: ${this.firstLink(html) ?? '(none)'}`);
        }
        return process.env.NODE_ENV !== 'production';
      }

      const from = await this.from();

      if (t.kind === 'smtp') {
        await t.smtp!.sendMail({ from, to, subject, html });
        return true;
      }

      const { error } = await t.resend!.emails.send({ from, to, subject, html });
      if (error) {
        this.logger.error(`Resend rejected mail to ${to}: ${error.message}`);
        return false;
      }
      return true;
    } catch (err: any) {
      this.logger.error(`Failed sending mail to ${to}: ${err?.message ?? err}`);
      return false;
    }
  }

  /** Pulls the action URL out of a rendered email, for local development only. */
  private firstLink(html: string): string | null {
    return html.match(/href="([^"]+)"/)?.[1] ?? null;
  }

  // ─── Templates ────────────────────────────────────────────────────────────

  private layout(heading: string, body: string, cta?: { label: string; url: string }) {
    const button = cta
      ? `<tr><td style="padding:8px 0 24px">
           <a href="${cta.url}" style="display:inline-block;background:#2563eb;color:#fff;
              text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;
              font-size:15px">${cta.label}</a>
         </td></tr>
         <tr><td style="padding-bottom:8px;color:#64748b;font-size:13px;line-height:1.6">
           If the button doesn't work, paste this into your browser:<br>
           <span style="color:#2563eb;word-break:break-all">${cta.url}</span>
         </td></tr>`
      : '';

    return `<!doctype html>
<html><body style="margin:0;background:#f1f5f9;padding:32px 16px;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
         style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;
                padding:36px 34px;border:1px solid #e2e8f0">
    <tr><td style="padding-bottom:22px;font-size:19px;font-weight:700;color:#0f172a">
      📚 Universal Book
    </td></tr>
    <tr><td style="padding-bottom:12px;font-size:21px;font-weight:700;color:#0f172a">
      ${heading}
    </td></tr>
    <tr><td style="padding-bottom:22px;color:#334155;font-size:15px;line-height:1.65">
      ${body}
    </td></tr>
    ${button}
    <tr><td style="padding-top:22px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px">
      Universal Book · AI-powered social publishing
    </td></tr>
  </table>
</body></html>`;
  }

  // ─── Messages ─────────────────────────────────────────────────────────────

  async sendPasswordReset(to: string, name: string | null, token: string) {
    const url = `${await this.appUrl()}/auth/reset-password?token=${encodeURIComponent(token)}`;
    return this.send(
      to,
      'Reset your Universal Book password',
      this.layout(
        'Reset your password',
        `Hi${name ? ` ${name}` : ''}, we received a request to reset your password.
         This link expires in 1 hour and can only be used once.
         If you didn't ask for this, you can safely ignore this email — nothing will change.`,
        { label: 'Choose a new password', url },
      ),
    );
  }

  async sendEmailVerification(to: string, name: string | null, token: string) {
    const url = `${await this.appUrl()}/auth/verify-email?token=${encodeURIComponent(token)}`;
    return this.send(
      to,
      'Confirm your email address',
      this.layout(
        'Confirm your email',
        `Welcome${name ? ` ${name}` : ''}! Confirm this address to secure your account
         and enable password recovery.`,
        { label: 'Confirm email', url },
      ),
    );
  }
}

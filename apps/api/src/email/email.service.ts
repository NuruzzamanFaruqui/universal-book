import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';

const APP_URL = process.env.APP_URL || 'https://universal-book.com';
const FROM = process.env.EMAIL_FROM || 'Universal Book <noreply@universal-book.com>';

type Transport = 'smtp' | 'resend' | 'console';

/**
 * Sends transactional mail through whichever transport is configured.
 *
 * SMTP wins if SMTP_HOST is set, so any mailbox you already own works —
 * Namecheap Private Email, Google Workspace, a VPS relay. Resend is a fallback
 * for when no SMTP route is available. With neither, mail is logged rather than
 * sent, which is fine locally and a silent lockout in production.
 *
 * Note for Cloud Run: GCP blocks outbound port 25 outright, and default egress
 * usually blocks 465/587 as well — SMTP from Cloud Run generally needs a
 * Serverless VPC connector with Cloud NAT. Resend goes over HTTPS and does not.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transport: Transport;
  private readonly smtp: nodemailer.Transporter | null = null;
  private readonly resend: Resend | null = null;

  constructor() {
    if (process.env.SMTP_HOST) {
      const port = Number(process.env.SMTP_PORT || 587);
      this.smtp = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        // 465 is implicit TLS; 587 upgrades via STARTTLS.
        secure: port === 465,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
      });
      this.transport = 'smtp';
      this.logger.log(`Email transport: SMTP via ${process.env.SMTP_HOST}:${port}`);
    } else if (process.env.RESEND_API_KEY) {
      this.resend = new Resend(process.env.RESEND_API_KEY);
      this.transport = 'resend';
      this.logger.log('Email transport: Resend');
    } else {
      this.transport = 'console';
      this.logger.warn(
        'No SMTP_HOST and no RESEND_API_KEY — emails will be logged, not sent. ' +
        'Password reset will not work for real users.',
      );
    }
  }


  // ─── Transport ────────────────────────────────────────────────────────────

  /**
   * Never throws. A failed email must not fail the request that triggered it —
   * password reset returns the same response whether or not delivery worked, so
   * that the endpoint can't be used to enumerate registered addresses.
   */
  private async send(to: string, subject: string, html: string): Promise<boolean> {
    try {
      if (this.transport === 'console') {
        this.logger.log(`[email:stub] to=${to} subject="${subject}"`);
        this.logger.debug(html);
        return true;
      }

      if (this.transport === 'smtp') {
        await this.smtp!.sendMail({ from: FROM, to, subject, html });
        return true;
      }

      const { error } = await this.resend!.emails.send({ from: FROM, to, subject, html });
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
    const url = `${APP_URL}/auth/reset-password?token=${encodeURIComponent(token)}`;
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
    const url = `${APP_URL}/auth/verify-email?token=${encodeURIComponent(token)}`;
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

import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { MailService } from '@sendgrid/mail';
import { RuntimeConfigService } from '../config/runtime-config.service';

type Transport = 'sendgrid' | 'smtp' | 'resend' | 'console';

/** Long enough for a healthy provider, short enough not to stall the request that triggered it. */
const SEND_TIMEOUT_MS = 5_000;

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Groups messages in the SendGrid activity feed, e.g. "new-follower". */
  category: string;
}

interface Rendered {
  html: string;
  text: string;
}

/** Escapes a user-supplied value for interpolation into an HTML body. */
export function esc(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** A user-supplied value made safe for a subject line: one line, no markup concerns. */
function plain(value: string | null | undefined, fallback: string): string {
  const v = (value ?? '').replace(/[\r\n]+/g, ' ').trim();
  return v || fallback;
}

const money = (n: number) => `$${n.toFixed(2)}`;

/**
 * Sends transactional mail through whichever transport is configured.
 *
 * Order of preference: SendGrid, then SMTP, then Resend. With none, mail is
 * logged rather than sent — fine locally, a silent lockout in production.
 *
 * Everything resolves through RuntimeConfigService rather than process.env, so
 * keys entered in Admin → API Management take effect without a redeploy.
 *
 * Note for Cloud Run: GCP blocks outbound port 25 outright and usually 465/587
 * as well, so SMTP generally needs a Serverless VPC connector with Cloud NAT.
 * SendGrid and Resend go over HTTPS and do not.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private sendgrid: MailService | null = null;
  private sendgridKey = '';
  private smtp: nodemailer.Transporter | null = null;
  private smtpKey = '';
  private resend: Resend | null = null;
  private resendKey = '';

  constructor(private config: RuntimeConfigService) {}

  private async transport(): Promise<{
    kind: Transport;
    sendgrid?: MailService;
    smtp?: nodemailer.Transporter;
    resend?: Resend;
  }> {
    const sgKey = await this.config.get('SENDGRID_API_KEY');
    if (sgKey) {
      if (!this.sendgrid || this.sendgridKey !== sgKey) {
        // A dedicated instance rather than the package's singleton, so a key
        // changed in the admin panel replaces this one cleanly.
        const client = new MailService();
        client.setApiKey(sgKey);
        client.setTimeout(SEND_TIMEOUT_MS);
        this.sendgrid = client;
        this.sendgridKey = sgKey;
      }
      return { kind: 'sendgrid', sendgrid: this.sendgrid };
    }

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
    return { transport: t.kind, ok: true };
  }

  private async from(): Promise<string> {
    return (await this.config.get('EMAIL_FROM')) || 'Universal Book <noreply@universal-book.com>';
  }

  private async appUrl(): Promise<string> {
    const url = (await this.config.get('APP_URL')) || 'https://universal-book.com';
    return url.replace(/\/+$/, '');
  }

  // ─── Transport ────────────────────────────────────────────────────────────

  /**
   * Never throws. A failed email must not fail the request that triggered it —
   * a purchase, follow or connection has already been saved by the time this
   * runs, and password reset returns the same response whether or not delivery
   * worked, so the endpoint cannot be used to enumerate registered addresses.
   */
  async sendEmail({ to, subject, html, text, category }: OutgoingEmail): Promise<boolean> {
    if (!to) {
      this.logger.warn(`No recipient for "${subject}"; skipping.`);
      return false;
    }

    try {
      const t = await this.transport();

      if (t.kind === 'console') {
        // Never log the body: these carry single-use reset links, and anyone
        // with log access could redeem one.
        this.logger.warn(
          `No email transport configured — dropping "${subject}" to ${to}. ` +
          'Set SendGrid, SMTP or Resend in Admin → API Management.',
        );
        if (process.env.NODE_ENV !== 'production') {
          this.logger.debug(`[dev] link for ${to}: ${this.firstLink(html) ?? '(none)'}`);
        }
        return process.env.NODE_ENV !== 'production';
      }

      const from = await this.from();

      if (t.kind === 'sendgrid') {
        await t.sendgrid!.send({
          to, from, subject, html, text,
          categories: [category],
          // Tracking rewrites every link through a SendGrid redirect, which
          // spam filters distrust and which makes the links look phishy.
          trackingSettings: {
            clickTracking: { enable: false, enableText: false },
            openTracking: { enable: false },
          },
        });
        return true;
      }

      if (t.kind === 'smtp') {
        await t.smtp!.sendMail({ from, to, subject, html, text });
        return true;
      }

      const { error } = await t.resend!.emails.send({ from, to, subject, html, text });
      if (error) {
        this.logger.error(`Resend rejected mail to ${to}: ${error.message}`);
        return false;
      }
      return true;
    } catch (err: any) {
      // SendGrid puts the actual reason (unverified sender, bad key) in the body.
      const detail = err?.response?.body?.errors
        ? JSON.stringify(err.response.body.errors)
        : err?.message ?? String(err);
      this.logger.error(`Failed sending "${subject}" to ${to}: ${detail}`);
      return false;
    }
  }

  /** Pulls the action URL out of a rendered email, for local development only. */
  private firstLink(html: string): string | null {
    return html.match(/href="([^"]+)"/)?.[1] ?? null;
  }

  // ─── Templates ────────────────────────────────────────────────────────────

  /**
   * `heading` and `body` are HTML: escape any user-supplied value with esc()
   * before passing it in. The plain-text part is derived from them.
   */
  private layout(heading: string, body: string, cta?: { label: string; url: string }): Rendered {
    const button = cta
      ? `<tr><td style="padding:8px 0 24px">
           <a href="${esc(cta.url)}" style="display:inline-block;background:#2563eb;color:#fff;
              text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;
              font-size:15px">${cta.label}</a>
         </td></tr>
         <tr><td style="padding-bottom:8px;color:#64748b;font-size:13px;line-height:1.6">
           If the button doesn't work, paste this into your browser:<br>
           <span style="color:#2563eb;word-break:break-all">${esc(cta.url)}</span>
         </td></tr>`
      : '';

    const html = `<!doctype html>
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

    const text = [
      this.toText(heading),
      this.toText(body),
      cta ? `${this.toText(cta.label)}: ${cta.url}` : '',
      '—\nUniversal Book · AI-powered social publishing',
    ].filter(Boolean).join('\n\n');

    return { html, text };
  }

  /** HTML fragment → plain text: paragraphs become blank lines, tags and entities go. */
  private toText(fragment: string): string {
    return fragment
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/[ \t]*\n[ \t]*/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim();
  }

  private greeting(name: string | null | undefined): string {
    return `Hi ${esc(plain(name, 'there'))},`;
  }

  // ─── Account messages ─────────────────────────────────────────────────────

  async sendPasswordReset(to: string, name: string | null, token: string) {
    const url = `${await this.appUrl()}/auth/reset-password?token=${encodeURIComponent(token)}`;
    return this.sendEmail({
      to,
      subject: 'Reset your Universal Book password',
      category: 'password-reset',
      ...this.layout(
        'Reset your password',
        `Hi${name ? ` ${esc(name)}` : ''}, we received a request to reset your password.
         This link expires in 1 hour and can only be used once.
         If you didn't ask for this, you can safely ignore this email — nothing will change.`,
        { label: 'Choose a new password', url },
      ),
    });
  }

  async sendEmailVerification(to: string, name: string | null, token: string) {
    const url = `${await this.appUrl()}/auth/verify-email?token=${encodeURIComponent(token)}`;
    return this.sendEmail({
      to,
      subject: 'Confirm your email address',
      category: 'email-verification',
      ...this.layout(
        'Confirm your email',
        `Welcome${name ? ` ${esc(name)}` : ''}! Confirm this address to secure your account
         and enable password recovery.`,
        { label: 'Confirm email', url },
      ),
    });
  }

  // ─── Notification messages ────────────────────────────────────────────────

  async sendConnectionRequest(p: { to: string; recipientName: string | null; senderName: string | null }) {
    const sender = plain(p.senderName, 'A Universal Book member');
    return this.sendEmail({
      to: p.to,
      subject: `${sender} wants to connect on Universal Book`,
      category: 'connection-request',
      ...this.layout(
        'New connection request',
        `<p>${this.greeting(p.recipientName)}</p>
         <p>${esc(sender)} sent you a connection request on Universal Book.</p>`,
        { label: 'Review request', url: `${await this.appUrl()}/notifications` },
      ),
    });
  }

  async sendConnectionAccepted(p: {
    to: string;
    recipientName: string | null;
    accepterName: string | null;
    accepterId: string;
  }) {
    const accepter = plain(p.accepterName, 'A Universal Book member');
    return this.sendEmail({
      to: p.to,
      subject: `${accepter} accepted your connection request`,
      category: 'connection-accepted',
      ...this.layout(
        'You have a new connection',
        `<p>${this.greeting(p.recipientName)}</p>
         <p>${esc(accepter)} accepted your connection request. You're now connected —
         say hello or see what they're writing.</p>`,
        { label: 'View profile', url: `${await this.appUrl()}/profile/${encodeURIComponent(p.accepterId)}` },
      ),
    });
  }

  async sendBookPurchased(p: {
    to: string;
    recipientName: string | null;
    bookTitle: string;
    authorName: string | null;
    amount: number;
    paymentMethod: 'card' | 'credits';
  }) {
    const title = plain(p.bookTitle, 'your book');
    const paid = p.amount > 0
      ? `Paid: ${money(p.amount)} (${p.paymentMethod === 'card' ? 'card' : 'credits'})`
      : 'This book was free.';
    return this.sendEmail({
      to: p.to,
      subject: `Your copy of "${title}" is ready`,
      category: 'book-purchased',
      ...this.layout(
        'Thanks for your purchase',
        `<p>${this.greeting(p.recipientName)}</p>
         <p>"${esc(title)}" by ${esc(plain(p.authorName, 'its author'))} is now in your library.</p>
         <p style="color:#64748b;font-size:14px">${paid}</p>`,
        { label: 'Start reading', url: `${await this.appUrl()}/library` },
      ),
    });
  }

  /** The buyer is deliberately not named: authors see sales, not who bought. */
  async sendBookSold(p: { to: string; recipientName: string | null; bookTitle: string; earning: number }) {
    const title = plain(p.bookTitle, 'your book');
    return this.sendEmail({
      to: p.to,
      subject: `You made a sale: "${title}"`,
      category: 'book-sold',
      ...this.layout(
        'You made a sale',
        `<p>${this.greeting(p.recipientName)}</p>
         <p>A reader just bought "${esc(title)}". ${money(p.earning)} has been added to your
         Universal Book balance.</p>`,
        { label: 'View earnings', url: `${await this.appUrl()}/dashboard/earnings` },
      ),
    });
  }

  async sendNewFollower(p: {
    to: string;
    recipientName: string | null;
    followerName: string | null;
    followerId: string;
  }) {
    const follower = plain(p.followerName, 'A reader');
    return this.sendEmail({
      to: p.to,
      subject: `${follower} started following you`,
      category: 'new-follower',
      ...this.layout(
        'You have a new follower',
        `<p>${this.greeting(p.recipientName)}</p>
         <p>${esc(follower)} is now following you on Universal Book and will see your new books.</p>`,
        { label: 'View profile', url: `${await this.appUrl()}/profile/${encodeURIComponent(p.followerId)}` },
      ),
    });
  }
}

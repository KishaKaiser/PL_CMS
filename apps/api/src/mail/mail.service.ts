import { Injectable, Logger } from '@nestjs/common';
import type { Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { EmailSettingsService, type EffectiveMailConfig } from './email-settings.service';

export { escapeHtml } from './escape-html';

export interface MailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}

export interface SendOptions {
  /** What the email is for ("order-confirmation", "test"...), kept in the log on the admin Email page. */
  kind?: string;
  replyTo?: string;
}

const LOG_KEEP_DAYS = 90;

/**
 * Sends email through the account set up on the admin Email page (iCloud Mail, or another SMTP server), or else through the
 * server's SMTP_* environment variables. With neither, nothing is sent: the message is only noted in the log and `send` says
 * so, so callers can show the admin another way to pass the message on (such as a link to copy). Every attempt is recorded
 * so the admin can see what was sent and why one failed.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: { key: string; transport: Transporter } | null = null;
  private lastPruneAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: EmailSettingsService,
  ) {}

  async isConfigured(): Promise<boolean> {
    try {
      return (await this.settings.getEffective()) !== null;
    } catch {
      return false;
    }
  }

  /** True if the message was handed to the mail server. Never throws. */
  async send(message: MailMessage, options: SendOptions = {}): Promise<boolean> {
    const recipients = [message.to].flat().join(', ');
    const kind = options.kind ?? 'general';
    let config: EffectiveMailConfig | null = null;
    try {
      config = await this.settings.getEffective();
    } catch (error) {
      this.logger.error(`Could not read the email settings: ${describe(error)}`);
    }
    if (!config) {
      this.logger.log(`[Email] "${message.subject}" to ${recipients} was not sent: email is not set up (Admin → Email).`);
      return false;
    }

    try {
      const transport = await this.getTransport(config);
      await transport.sendMail({
        from: config.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(options.replyTo || config.replyTo ? { replyTo: options.replyTo ?? config.replyTo } : {}),
      });
      this.logger.log(`Email "${message.subject}" sent to ${recipients}`);
      await this.record(recipients, message.subject, kind, 'SENT', null);
      return true;
    } catch (error) {
      const reason = friendlyMailError(error);
      this.logger.error(`Could not send "${message.subject}" to ${recipients}: ${describe(error)}`);
      await this.record(recipients, message.subject, kind, 'FAILED', reason);
      return false;
    }
  }

  /** Checks the connection and password, then sends a test message. Returns what to tell the admin. */
  async sendTest(to: string): Promise<{ ok: boolean; message: string }> {
    let config: EffectiveMailConfig | null = null;
    try {
      config = await this.settings.getEffective();
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'The email settings could not be read.' };
    }
    if (!config) return { ok: false, message: 'Email is not set up yet. Fill in the account details and save them first.' };

    try {
      const transport = await this.getTransport(config);
      await transport.verify();
    } catch (error) {
      const reason = friendlyMailError(error);
      await this.record(to, 'Test email', 'test', 'FAILED', reason);
      return { ok: false, message: reason };
    }

    const text = 'This is a test email from your site. If you are reading it, email is working.';
    const sent = await this.send(
      {
        to,
        subject: 'Test email from your site',
        text,
        html: `<p style="font-family:Arial,sans-serif">${text}</p>`,
      },
      { kind: 'test' },
    );
    if (!sent) {
      const last = await this.prisma.emailLog.findFirst({ where: { kind: 'test', to }, orderBy: { createdAt: 'desc' } });
      return { ok: false, message: last?.error ?? 'The test email could not be sent.' };
    }
    return { ok: true, message: `A test email was sent to ${to}. Check that inbox (and its junk folder).` };
  }

  private async getTransport(config: EffectiveMailConfig): Promise<Transporter> {
    const key = JSON.stringify([config.host, config.port, config.secure, config.requireTLS, config.auth?.user, config.auth?.pass]);
    if (this.transporter?.key === key) return this.transporter.transport;
    const nodemailer = await import('nodemailer');
    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: config.requireTLS,
      ...(config.auth ? { auth: config.auth } : {}),
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });
    this.transporter = { key, transport };
    return transport;
  }

  private async record(to: string, subject: string, kind: string, status: 'SENT' | 'FAILED', error: string | null) {
    try {
      await this.prisma.emailLog.create({
        data: { to: to.slice(0, 500), subject: subject.slice(0, 300), kind, status, error: error ? error.slice(0, 500) : null },
      });
      if (Date.now() - this.lastPruneAt > 24 * 60 * 60 * 1000) {
        this.lastPruneAt = Date.now();
        await this.prisma.emailLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - LOG_KEEP_DAYS * 24 * 60 * 60 * 1000) } } });
      }
    } catch (logError) {
      this.logger.warn(`Could not record the email in the log: ${describe(logError)}`);
    }
  }
}

function describe(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/** Turns a mail server error into something the site owner can act on, with iCloud's usual causes called out. */
export function friendlyMailError(error: unknown): string {
  const info = error as { code?: string; responseCode?: number; response?: string; message?: string } | null;
  const code = info?.code ?? '';
  const responseCode = info?.responseCode ?? 0;
  const detail = `${info?.response ?? info?.message ?? ''}`.toLowerCase();

  if (code === 'EAUTH' || responseCode === 535 || responseCode === 534 || detail.includes('authentication')) {
    return 'The mail server did not accept the sign-in. For iCloud, use your full iCloud address as the username and an app-specific password (not your Apple ID password) from appleid.apple.com → Sign-In and Security → App-Specific Passwords.';
  }
  if (responseCode === 553 || responseCode === 550 || detail.includes('sender') || detail.includes('not authorized')) {
    return 'The mail server did not accept the "from" address. iCloud only sends from your iCloud address or one of its aliases.';
  }
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EDNS') {
    return 'Could not reach the mail server. Check the server name and port (iCloud: smtp.mail.me.com, port 587).';
  }
  if (code === 'ETIMEDOUT' || code === 'ESOCKET' || code === 'ECONNECTION' || code === 'ECONNRESET') {
    return 'The mail server did not answer in time. Check the server name and port, and that this server can make outgoing mail connections.';
  }
  if (responseCode === 421 || responseCode === 450 || responseCode === 451 || responseCode === 452) {
    return 'The mail server asked to try again later. iCloud limits how many emails can be sent in a day; wait a while and try again.';
  }
  return (info?.message ?? 'The email could not be sent.').slice(0, 300);
}

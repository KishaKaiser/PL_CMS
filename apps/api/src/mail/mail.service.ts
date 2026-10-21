import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface MailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends email through the SMTP server named in the site's environment (SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER,
 * SMTP_PASS and SMTP_FROM). Without SMTP_HOST nothing is sent: the message is only noted in the log and `send` says so,
 * so callers can show the admin another way to pass the message on (such as a link to copy).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  get configured(): boolean {
    return !!this.config.get<string>('SMTP_HOST');
  }

  /** True if the message was handed to the mail server. Never throws. */
  async send(message: MailMessage): Promise<boolean> {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      this.logger.log(`[Email] "${message.subject}" to ${[message.to].flat().join(', ')} was not sent: SMTP_HOST is not set.`);
      return false;
    }

    try {
      const nodemailer = await import('nodemailer').catch(() => null);
      if (!nodemailer) {
        this.logger.warn('nodemailer is not installed, so email cannot be sent.');
        return false;
      }
      const port = Number(this.config.get<string>('SMTP_PORT')) || 587;
      const user = this.config.get<string>('SMTP_USER');
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: String(this.config.get<string>('SMTP_SECURE') ?? port === 465).toLowerCase() === 'true',
        ...(user ? { auth: { user, pass: this.config.get<string>('SMTP_PASS') } } : {}),
      });
      await transporter.sendMail({
        from: this.config.get<string>('SMTP_FROM') ?? user ?? 'no-reply@example.com',
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      this.logger.log(`Email "${message.subject}" sent to ${[message.to].flat().join(', ')}`);
      return true;
    } catch (error) {
      this.logger.error(`Could not send "${message.subject}": ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}

/** Escapes text going into the HTML of an email. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string);
}

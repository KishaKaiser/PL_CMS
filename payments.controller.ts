import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendShipmentNotification(opts: {
    to: string;
    customerName: string;
    orderId: string;
    trackingNumber?: string | null;
    carrier?: string | null;
    labelUrl?: string | null;
  }): Promise<void> {
    const smtpHost = this.config.get<string>('SMTP_HOST');
    if (!smtpHost) {
      this.logger.log(
        `[Email] Order ${opts.orderId} shipped → ${opts.to}. Tracking: ${opts.trackingNumber ?? 'N/A'} (SMTP not configured, skipping send)`,
      );
      return;
    }

    try {
      // Dynamically import nodemailer to avoid hard dependency at startup
      const nodemailerModule = await import('nodemailer').catch(() => null);
      if (!nodemailerModule) {
        this.logger.warn('nodemailer is not installed. Email notification skipped.');
        return;
      }

      const transporter = nodemailerModule.createTransport({
        host: smtpHost,
        port: this.config.get<number>('SMTP_PORT') ?? 587,
        secure: this.config.get<boolean>('SMTP_SECURE') ?? false,
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
      });

      const trackingLine = opts.trackingNumber
        ? `<p>Tracking number: <strong>${opts.trackingNumber}</strong>${opts.carrier ? ` (${opts.carrier})` : ''}</p>`
        : '';

      await transporter.sendMail({
        from: this.config.get<string>('SMTP_FROM') ?? 'no-reply@example.com',
        to: opts.to,
        subject: `Your order #${opts.orderId} has shipped!`,
        html: `<p>Hi ${opts.customerName},</p>
<p>Great news – your order <strong>#${opts.orderId}</strong> has been shipped.</p>
${trackingLine}
<p>Thank you for your purchase!</p>`,
      });

      this.logger.log(`Shipment notification sent to ${opts.to} for order ${opts.orderId}`);
    } catch (err) {
      this.logger.error(
        `Failed to send shipment notification to ${opts.to}: ${String(err)}`,
      );
    }
  }
}

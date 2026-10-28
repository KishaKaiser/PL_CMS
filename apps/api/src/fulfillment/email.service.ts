import { Injectable } from '@nestjs/common';
import { OrderEmailService } from '../mail/order-emails.service';

/** Kept so the shipping code does not change: the notice itself is built and sent by the order emails (Admin → Email). */
@Injectable()
export class EmailService {
  constructor(private readonly orderEmails: OrderEmailService) {}

  async sendShipmentNotification(opts: {
    to: string;
    customerName: string;
    orderId: string;
    trackingNumber?: string | null;
    carrier?: string | null;
    labelUrl?: string | null;
  }): Promise<void> {
    await this.orderEmails.sendShipped({ orderId: opts.orderId, to: opts.to, trackingNumber: opts.trackingNumber, carrier: opts.carrier });
  }
}

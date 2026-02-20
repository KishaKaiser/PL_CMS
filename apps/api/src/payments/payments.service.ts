import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaypalService } from '../checkout/paypal.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paypal: PaypalService,
  ) {}

  /**
   * Handle an incoming PayPal webhook event.
   * Verifies the PayPal signature, then processes supported event types.
   */
  async handlePaypalWebhook(
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<{ received: boolean }> {
    const verified = await this.paypal.verifyWebhookSignature(headers, rawBody);
    if (!verified) {
      throw new BadRequestException('Invalid PayPal webhook signature');
    }

    let event: {
      event_type: string;
      resource?: {
        id?: string;
        purchase_units?: Array<{ reference_id?: string }>;
        payer?: { email_address?: string };
      };
    };

    try {
      event = JSON.parse(rawBody) as typeof event;
    } catch {
      throw new BadRequestException('Invalid JSON in PayPal webhook body');
    }

    this.logger.log(`PayPal webhook received: ${event.event_type}`);

    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await this.onCaptureCompleted(event.resource);
        break;
      case 'PAYMENT.CAPTURE.DENIED':
        await this.onCaptureDenied(event.resource);
        break;
      default:
        this.logger.log(`Unhandled PayPal event: ${event.event_type}`);
    }

    return { received: true };
  }

  private async onCaptureCompleted(resource?: {
    id?: string;
    purchase_units?: Array<{ reference_id?: string }>;
    payer?: { email_address?: string };
  }) {
    const paypalOrderId = resource?.id;
    if (!paypalOrderId) return;

    const order = await this.prisma.order.findUnique({
      where: { paypalOrderId },
    });
    if (!order) {
      this.logger.warn(`No order found for PayPal ID ${paypalOrderId}`);
      return;
    }

    // Idempotency: skip if already confirmed
    if (order.status === 'CONFIRMED') {
      this.logger.log(`Order ${order.id} already confirmed; skipping webhook`);
      return;
    }

    await this.prisma.payment.upsert({
      where: { transactionId: paypalOrderId },
      create: {
        orderId: order.id,
        amount: order.totalAmount,
        currency: order.currency,
        method: 'CARD',
        status: 'SUCCEEDED',
        transactionId: paypalOrderId,
      },
      update: { status: 'SUCCEEDED' },
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'CONFIRMED',
        payerEmail: resource?.payer?.email_address,
      },
    });

    this.logger.log(`Order ${order.id} confirmed via PayPal webhook`);
  }

  private async onCaptureDenied(resource?: { id?: string }) {
    const paypalOrderId = resource?.id;
    if (!paypalOrderId) return;

    const order = await this.prisma.order.findUnique({
      where: { paypalOrderId },
    });
    if (!order) return;

    await this.prisma.order.update({
      where: { id: order.id },
      data: { status: 'CANCELLED' },
    });

    this.logger.log(`Order ${order.id} cancelled via PayPal webhook (capture denied)`);
  }

  /**
   * Legacy webhook handler used by internal payment confirmations.
   */
  async handleWebhook(transactionId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: true } },
        user: { include: { clientProfile: true } },
      },
    });

    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    await this.prisma.payment.upsert({
      where: { transactionId },
      create: {
        orderId,
        amount: order.totalAmount,
        currency: order.currency,
        method: 'CARD',
        status: 'SUCCEEDED',
        transactionId,
      },
      update: { status: 'SUCCEEDED' },
    });

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CONFIRMED' },
    });

    let totalMinutes = 0;
    for (const item of order.items) {
      totalMinutes += item.product.minutesPack * item.quantity;
    }

    if (totalMinutes > 0 && order.user.clientProfile) {
      const clientProfileId = order.user.clientProfile.id;
      await this.prisma.clientProfile.update({
        where: { id: clientProfileId },
        data: { balanceMinutes: { increment: totalMinutes } },
      });
      await this.prisma.walletTransaction.create({
        data: {
          userId: order.userId,
          type: 'CREDIT',
          amount: order.totalAmount,
          currency: order.currency,
          description: `Purchased ${totalMinutes} minutes (order ${orderId})`,
        },
      });
      this.logger.log(`Credited ${totalMinutes} minutes to client ${order.userId}`);
    }

    return { success: true, minutesCredited: totalMinutes };
  }
}

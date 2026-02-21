import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaypalService } from '../checkout/paypal.service';

interface PaypalWebhookEvent {
  id?: string;
  event_type: string;
  resource?: {
    id?: string;
    status?: string;
    supplementary_data?: { related_ids?: { order_id?: string } };
    payer?: { email_address?: string };
  };
}

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

    let event: PaypalWebhookEvent;

    try {
      event = JSON.parse(rawBody) as PaypalWebhookEvent;
    } catch {
      throw new BadRequestException('Invalid JSON in PayPal webhook body');
    }

    this.logger.log(`PayPal webhook received: ${event.event_type}`);

    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await this.onCaptureCompleted(event);
        break;
      case 'PAYMENT.CAPTURE.DENIED':
        await this.onCaptureDenied(event);
        break;
      default:
        this.logger.log(`Unhandled PayPal event: ${event.event_type}`);
    }

    return { received: true };
  }

  private async creditMinutesIfNeeded(orderId: string, paymentId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: true } },
        user: { include: { clientProfile: true } },
      },
    });

    if (!order || !order.user.clientProfile) {
      return;
    }

    let totalMinutes = 0;
    for (const item of order.items) {
      totalMinutes += item.product.minutesPack * item.quantity;
    }

    if (totalMinutes <= 0) {
      return;
    }

    const existingCredit = await this.prisma.walletTransaction.findFirst({
      where: { paymentId, type: 'CREDIT' },
      select: { id: true },
    });

    if (existingCredit) {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.clientProfile.update({
        where: { id: order.user.clientProfile.id },
        data: { balanceMinutes: { increment: totalMinutes } },
      }),
      this.prisma.walletTransaction.create({
        data: {
          userId: order.userId,
          paymentId,
          type: 'CREDIT',
          amount: order.totalAmount,
          currency: order.currency,
          description: `Purchased ${totalMinutes} minutes via PayPal (order ${order.id})`,
        },
      }),
    ]);

    this.logger.log(`Credited ${totalMinutes} minutes to client ${order.userId}`);
  }

  private async onCaptureCompleted(event: PaypalWebhookEvent) {
    const captureId = event.resource?.id;
    if (!captureId) {
      this.logger.warn('PayPal capture completed webhook missing capture id');
      return;
    }

    const paypalOrderId = event.resource?.supplementary_data?.related_ids?.order_id;
    if (!paypalOrderId) {
      this.logger.warn(`Capture ${captureId} missing related PayPal order id`);
      return;
    }

    const order = await this.prisma.order.findUnique({ where: { paypalOrderId } });
    if (!order) {
      this.logger.warn(`No order found for PayPal order ID ${paypalOrderId}`);
      return;
    }

    const payment = await this.prisma.payment.upsert({
      where: { paypalCaptureId: captureId },
      create: {
        orderId: order.id,
        amount: order.totalAmount,
        currency: order.currency,
        method: 'CARD',
        status: 'SUCCEEDED',
        transactionId: event.id,
        paypalOrderId,
        paypalCaptureId: captureId,
      },
      update: {
        status: 'SUCCEEDED',
        paypalOrderId,
      },
      select: { id: true },
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'CONFIRMED',
        payerEmail: event.resource?.payer?.email_address,
      },
    });

    await this.creditMinutesIfNeeded(order.id, payment.id);

    this.logger.log(
      `Order ${order.id} confirmed via PayPal webhook (capture ${captureId})`,
    );
  }

  private async onCaptureDenied(event: PaypalWebhookEvent) {
    const paypalOrderId = event.resource?.supplementary_data?.related_ids?.order_id;
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

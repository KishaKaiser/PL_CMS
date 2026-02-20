import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Called when a payment provider confirms a payment succeeded.
   * Finds the order by transactionId, marks it CONFIRMED, and
   * credits the client's balanceMinutes for any minute-pack products.
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

    // Mark payment succeeded
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

    // Confirm order
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CONFIRMED' },
    });

    // Credit minute packs to client
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

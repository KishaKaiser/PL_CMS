import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { formatOrderNumber } from '@pl-cms/shared';
import { getOrderPrefix } from '../common/order-prefix';
import { FreeMinutesService } from '../free-minutes/free-minutes.service';
import { PrismaService } from '../prisma/prisma.service';

/** An order waiting for payment holds things: stock, the customer's wallet money, a promotion place. How long before they are given back. */
const UNPAID_ORDER_MS = 3 * 60 * 60 * 1000;
const MAX_PER_RUN = 50;

/**
 * Gives back what an order that will never be paid was holding. An order that uses the wallet balance takes that money when it
 * is created (so it cannot be spent twice, for example on a call); if the order is cancelled, refused by PayPal or simply
 * abandoned, the money goes back to the wallet here.
 */
@Injectable()
export class OrderHoldsService {
  private readonly logger = new Logger(OrderHoldsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly freeMinutes: FreeMinutesService,
  ) {}

  /** Cancels an order that is still waiting for payment and releases everything it held. False if it was not waiting. */
  async cancelPendingOrder(orderId: string): Promise<boolean> {
    // Only one caller wins the change from waiting to cancelled, so nothing is given back twice.
    const claimed = await this.prisma.order.updateMany({ where: { id: orderId, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    if (claimed.count === 0) return false;

    const items = await this.prisma.orderItem.findMany({ where: { orderId, variantId: { not: null } }, select: { variantId: true, quantity: true } });
    if (items.length > 0) {
      await this.prisma.$transaction(
        items.map((item) =>
          this.prisma.inventory.updateMany({ where: { variantId: item.variantId! }, data: { reserved: { decrement: item.quantity } } }),
        ),
      );
    }
    await this.releaseWallet(orderId);
    await this.freeMinutes.releaseClaimForOrder(orderId);
    return true;
  }

  /** Puts the wallet money an unpaid order took back in the customer's wallet. Returns the cents returned (0 if none, or already returned). */
  async releaseWallet(orderId: string): Promise<number> {
    const prefix = await getOrderPrefix(this.prisma);
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: orderId, status: { in: ['PENDING', 'CANCELLED'] }, walletAppliedCents: { gt: 0 }, walletReleasedAt: null },
        data: { walletReleasedAt: new Date() },
      });
      if (claimed.count === 0) return 0;

      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { orderNumber: true, userId: true, currency: true, walletAppliedCents: true, user: { select: { clientProfile: { select: { id: true } } } } },
      });
      const profileId = order?.user.clientProfile?.id;
      if (!order || !profileId) return 0;

      await tx.clientProfile.update({ where: { id: profileId }, data: { balanceCents: { increment: order.walletAppliedCents } } });
      await tx.walletTransaction.create({
        data: {
          userId: order.userId,
          orderId,
          type: 'CREDIT',
          amount: order.walletAppliedCents / 100,
          currency: order.currency,
          description: `Returned to your wallet: order ${formatOrderNumber(order.orderNumber, prefix)} was not paid`,
        },
      });
      return order.walletAppliedCents;
    });
  }

  /** Orders that used the wallet but were never paid (the PayPal window was closed, say) are cancelled after a few hours. */
  @Cron('*/10 * * * *')
  async cancelAbandonedOrders() {
    try {
      const stale = await this.prisma.order.findMany({
        where: {
          status: 'PENDING',
          walletAppliedCents: { gt: 0 },
          walletReleasedAt: null,
          createdAt: { lt: new Date(Date.now() - UNPAID_ORDER_MS) },
        },
        select: { id: true },
        take: MAX_PER_RUN,
      });
      for (const order of stale) {
        if (await this.cancelPendingOrder(order.id)) this.logger.log(`Cancelled unpaid order ${order.id} and returned its wallet money`);
      }
    } catch (error) {
      this.logger.warn(`Could not cancel abandoned orders: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckoutDto } from './checkout.dto';
import { PaypalService } from './paypal.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paypal: PaypalService,
    private readonly config: ConfigService,
  ) {}

  /** Build and persist an Order row; returns it with items. */
  private async buildOrder(userId: string, dto: CreateCheckoutDto) {
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });

    if (products.length !== productIds.length) {
      const foundIds = new Set(products.map((p) => p.id));
      const missing = productIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `One or more products are invalid or inactive: ${missing.join(', ')}`,
      );
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    let totalAmount = new Decimal(0);
    const items = dto.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const unitPrice = product.price;
      totalAmount = totalAmount.add(unitPrice.mul(item.quantity));
      return { productId: item.productId, quantity: item.quantity, unitPrice };
    });

    return this.prisma.order.create({
      data: {
        userId,
        totalAmount,
        currency: 'USD',
        items: { create: items },
      },
      include: { items: true },
    });
  }

  /** Legacy: create DB order only (plain checkout, no PayPal). */
  async createOrder(userId: string, dto: CreateCheckoutDto) {
    return this.buildOrder(userId, dto);
  }

  /**
   * PayPal Advanced Checkout – step 1:
   * Create DB order + PayPal order; return paypalOrderId and approval URL.
   */
  async createPaypalOrder(
    userId: string,
    dto: CreateCheckoutDto,
  ): Promise<{
    orderId: string;
    paypalOrderId: string;
    approvalUrl: string;
  }> {
    const order = await this.buildOrder(userId, dto);

    const webBase =
      this.config.get<string>('WEB_BASE_URL') ?? 'http://localhost:3000';
    const returnUrl = `${webBase}/shop/checkout?success=1&orderId=${order.id}`;
    const cancelUrl = `${webBase}/shop/checkout?cancelled=1&orderId=${order.id}`;

    const { paypalOrderId, approvalUrl } = await this.paypal.createOrder(
      order.id,
      order.totalAmount.toFixed(2),
      order.currency,
      returnUrl,
      cancelUrl,
    );

    await this.prisma.order.update({
      where: { id: order.id },
      data: { paypalOrderId },
    });

    return { orderId: order.id, paypalOrderId, approvalUrl };
  }

  /**
   * PayPal Advanced Checkout – step 2:
   * Capture the PayPal order; mark DB order as CONFIRMED.
   */
  async capturePaypalOrder(paypalOrderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { paypalOrderId },
      include: {
        items: { include: { product: true } },
        user: { include: { clientProfile: true } },
      },
    });

    if (!order) {
      throw new NotFoundException(
        `Order with PayPal ID ${paypalOrderId} not found`,
      );
    }

    // Idempotency: if already confirmed, return success without re-capturing
    if (order.status === 'CONFIRMED') {
      return {
        success: true,
        orderId: order.id,
        paypalOrderId,
        minutesCredited: 0,
      };
    }

    const capture = await this.paypal.captureOrder(paypalOrderId);

    if (capture.status !== 'COMPLETED') {
      this.logger.warn(
        `PayPal capture status ${capture.status} for order ${order.id}`,
      );
    }

    // Persist payment record (upsert for idempotency)
    await this.prisma.payment.upsert({
      where: { transactionId: paypalOrderId },
      create: {
        orderId: order.id,
        amount: order.totalAmount,
        currency: order.currency,
        method: 'CARD',
        status: capture.status === 'COMPLETED' ? 'SUCCEEDED' : 'PENDING',
        transactionId: paypalOrderId,
      },
      update: {
        status: capture.status === 'COMPLETED' ? 'SUCCEEDED' : 'PENDING',
      },
    });

    // Confirm order and store payer email
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: capture.status === 'COMPLETED' ? 'CONFIRMED' : 'PENDING',
        payerEmail: capture.payerEmail,
      },
    });

    // Credit minute packs
    let minutesCredited = 0;
    for (const item of order.items) {
      minutesCredited += item.product.minutesPack * item.quantity;
    }

    if (minutesCredited > 0 && order.user.clientProfile) {
      await this.prisma.clientProfile.update({
        where: { id: order.user.clientProfile.id },
        data: { balanceMinutes: { increment: minutesCredited } },
      });
      await this.prisma.walletTransaction.create({
        data: {
          userId: order.userId,
          type: 'CREDIT',
          amount: order.totalAmount,
          currency: order.currency,
          description: `Purchased ${minutesCredited} minutes via PayPal (order ${order.id})`,
        },
      });
    }

    return {
      success: capture.status === 'COMPLETED',
      orderId: order.id,
      paypalOrderId,
      minutesCredited,
    };
  }
}

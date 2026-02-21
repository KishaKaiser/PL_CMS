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

    // Validate variants if provided
    const variantIds = dto.items.map((i) => i.variantId).filter(Boolean) as string[];
    const variants =
      variantIds.length > 0
        ? await this.prisma.productVariant.findMany({
            where: { id: { in: variantIds }, isActive: true },
          })
        : [];
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    const productMap = new Map(products.map((p) => [p.id, p]));
    let totalAmount = new Decimal(0);
    const items = dto.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const variant = item.variantId ? variantMap.get(item.variantId) : undefined;
      const unitPrice = variant?.priceOverride ?? product.price;
      totalAmount = totalAmount.add(unitPrice.mul(item.quantity));
      return {
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        unitPrice,
      };
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

  private async creditMinutesIfNeeded(orderId: string, paymentId: string): Promise<number> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: true } },
        user: { include: { clientProfile: true } },
      },
    });

    if (!order || !order.user.clientProfile) {
      return 0;
    }

    let minutesCredited = 0;
    for (const item of order.items) {
      minutesCredited += item.product.minutesPack * item.quantity;
    }

    if (minutesCredited <= 0) {
      return 0;
    }

    const existingCredit = await this.prisma.walletTransaction.findFirst({
      where: {
        paymentId,
        type: 'CREDIT',
      },
      select: { id: true },
    });

    if (existingCredit) {
      return 0;
    }

    await this.prisma.$transaction([
      this.prisma.clientProfile.update({
        where: { id: order.user.clientProfile.id },
        data: { balanceMinutes: { increment: minutesCredited } },
      }),
      this.prisma.walletTransaction.create({
        data: {
          userId: order.userId,
          paymentId,
          type: 'CREDIT',
          amount: order.totalAmount,
          currency: order.currency,
          description: `Purchased ${minutesCredited} minutes via PayPal (order ${order.id})`,
        },
      }),
    ]);

    return minutesCredited;
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
   * Capture the PayPal order; minutes are credited only for COMPLETED captures.
   */
  async capturePaypalOrder(paypalOrderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { paypalOrderId },
    });

    if (!order) {
      throw new NotFoundException(
        `Order with PayPal ID ${paypalOrderId} not found`,
      );
    }

    const capture = await this.paypal.captureOrder(paypalOrderId);

    if (!capture.captureId) {
      this.logger.warn(`Missing capture ID for PayPal order ${paypalOrderId}`);
      throw new BadRequestException('PayPal capture response missing capture ID');
    }

    const existingPayment = await this.prisma.payment.findUnique({
      where: { paypalCaptureId: capture.captureId },
      select: { id: true, status: true, orderId: true },
    });

    if (existingPayment) {
      const minutesCredited = await this.creditMinutesIfNeeded(order.id, existingPayment.id);
      return {
        success: existingPayment.status === 'SUCCEEDED',
        orderId: order.id,
        paypalOrderId,
        captureId: capture.captureId,
        minutesCredited,
      };
    }

    const completed = capture.status === 'COMPLETED';

    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        amount: order.totalAmount,
        currency: order.currency,
        method: 'CARD',
        status: completed ? 'SUCCEEDED' : 'PENDING',
        transactionId: paypalOrderId,
        paypalOrderId,
        paypalCaptureId: capture.captureId,
      },
      select: { id: true },
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: completed ? 'CONFIRMED' : 'PENDING',
        payerEmail: capture.payerEmail,
      },
    });

    if (!completed) {
      this.logger.warn(
        `PayPal capture status ${capture.status} for order ${order.id}`,
      );
      return {
        success: false,
        orderId: order.id,
        paypalOrderId,
        captureId: capture.captureId,
        minutesCredited: 0,
      };
    }

    const minutesCredited = await this.creditMinutesIfNeeded(order.id, payment.id);

    return {
      success: true,
      orderId: order.id,
      paypalOrderId,
      captureId: capture.captureId,
      minutesCredited,
    };
  }

  listUserOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        items: { include: { product: true } },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserOrderById(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: { include: { product: true } },
        payments: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    return order;
  }
}

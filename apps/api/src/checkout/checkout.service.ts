import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckoutDto } from './checkout.dto';
import { PaypalService } from './paypal.service';
import { Decimal } from '@prisma/client/runtime/library';
import { StoreService } from '../store/store.service';
import { AstrologyReportsService } from '../astrology/astrology-reports.service';
import { CandlesService, ResolvedCandle } from '../candles/candles.service';
import { OrderEmailService } from '../mail/order-emails.service';
import { CartRecoveryService } from '../store/cart-recovery.service';
import { Prisma } from '@pl-cms/db';
import { formatOrderNumber } from '@pl-cms/shared';
import { getOrderPrefix } from '../common/order-prefix';
import { FreeMinutesService } from '../free-minutes/free-minutes.service';
import { OrderHoldsService } from './order-holds.service';

/** How the wallet balance is used on an order: not at all, as much as it covers (PayPal pays the rest), or it must cover everything. */
type WalletMode = 'none' | 'partial' | 'full';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paypal: PaypalService,
    private readonly config: ConfigService,
    private readonly store: StoreService,
    private readonly astrologyReports: AstrologyReportsService,
    private readonly candles: CandlesService,
    private readonly orderEmails: OrderEmailService,
    private readonly cartRecovery: CartRecoveryService,
    private readonly freeMinutes: FreeMinutesService,
    private readonly holds: OrderHoldsService,
  ) {}

  /** Build and persist an Order row; returns it with items. `ip` is the customer's address, used by the new customer promotion. */
  private async buildOrder(userId: string, dto: CreateCheckoutDto, options: { ip?: string; wallet?: WalletMode } = {}) {
    const walletMode: WalletMode = options.wallet ?? 'none';
    // A custom candle line is a hidden product plus what the customer chose. The server decides the product and
    // the price: nothing the browser says about either is trusted, and no stock is reserved for it (made to order).
    const customPricing = new Map<number, ResolvedCandle>();
    let items = dto.items;
    if (items.some((item) => item.custom)) {
      const customProductId = await this.candles.ensureCustomProductId();
      items = items.map((item) => (item.custom ? { ...item, productId: customProductId, variantId: undefined } : item));
      for (const [index, item] of items.entries()) {
        if (item.custom) customPricing.set(index, await this.candles.resolveSelection(item.custom));
      }
    }

    const productIds = items.map((i) => i.productId);
    const uniqueProductIds = [...new Set(productIds)];
    const products = await this.prisma.product.findMany({
      where: { id: { in: uniqueProductIds }, isActive: true },
    });

    if (products.length !== uniqueProductIds.length) {
      const foundIds = new Set(products.map((p) => p.id));
      const missing = uniqueProductIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `One or more products are invalid or inactive: ${missing.join(', ')}`,
      );
    }

    // Wallet credit is credited at full price, so a coupon would let someone
    // pay less than they receive.
    if (dto.couponCode && products.some((product) => product.minutesPack > 0)) {
      throw new BadRequestException('Coupons cannot be used on wallet credit.');
    }
    // Paying for wallet credit with wallet money would just move money around.
    if (walletMode !== 'none' && products.some((product) => product.minutesPack > 0)) {
      throw new BadRequestException('Your wallet balance cannot be used to add money to your wallet.');
    }

    // The new customer promotion is a hidden product bought on its own. The server sets its price and minutes.
    const promoProductId = await this.freeMinutes.promoProductId();
    const buyingPromo = promoProductId !== null && items.some((item) => item.productId === promoProductId);
    let promoTerms: { priceCents: number; minutes: number } | null = null;
    if (buyingPromo) {
      if (items.length !== 1 || items[0].quantity !== 1 || items[0].variantId || items[0].custom) {
        throw new BadRequestException('The new customer offer is checked out on its own, one at a time.');
      }
      if (dto.couponCode) throw new BadRequestException('Coupons cannot be used on this offer.');
      promoTerms = await this.freeMinutes.promoTerms();
    }

    // Validate variants exist and are active
    const variantIds = items.map((i) => i.variantId).filter(Boolean) as string[];
    const variants =
      variantIds.length > 0
        ? await this.prisma.productVariant.findMany({
            where: { id: { in: variantIds }, isActive: true },
            include: { inventory: true },
          })
        : [];
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    for (const item of items) {
      if (!item.variantId) continue;
      if (!variantMap.has(item.variantId)) {
        throw new BadRequestException(
          `Variant ${item.variantId} is invalid or inactive`,
        );
      }
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    const itemSubtotalBeforeTx = items.reduce((sum, item, index) => {
      const product = productMap.get(item.productId)!;
      const variant = item.variantId ? variantMap.get(item.variantId) : undefined;
      const unitPrice =
        (promoTerms ? new Decimal(promoTerms.priceCents).div(100) : undefined) ??
        customPricing.get(index)?.unitPrice ??
        variant?.priceOverride ??
        getEffectiveProductPrice(product);
      return sum.add(unitPrice.mul(item.quantity));
    }, new Decimal(0));

    const requiresShipping = products.some((product) => product.type === 'PHYSICAL');
    let shippingDecimal =
      dto.shippingAmount != null ? new Decimal(dto.shippingAmount) : new Decimal(0);

    if (!requiresShipping) {
      shippingDecimal = new Decimal(0);
    }

    // Require carrier and service when a non-zero shipping amount is provided,
    // so clients cannot set arbitrary shipping costs for physical products.
    if (shippingDecimal.gt(0) && (!dto.shippingCarrier || !dto.shippingService)) {
      throw new BadRequestException(
        'shippingCarrier and shippingService are required when shippingAmount > 0',
      );
    }

    const freeShipping = await this.store.getFreeShippingSettings();
    if (
      freeShipping.enabled &&
      itemSubtotalBeforeTx.greaterThanOrEqualTo(new Decimal(freeShipping.minimumSubtotal ?? 0))
    ) {
      shippingDecimal = new Decimal(0);
    }

    let discountDecimal = new Decimal(0);
    if (dto.couponCode) {
      const validation = await this.store.validateCoupon(dto.couponCode, itemSubtotalBeforeTx.toNumber());
      if (!validation.valid) throw new BadRequestException(validation.message);
      discountDecimal = new Decimal(validation.discountAmount);
    }

    const ecommerceSettings = await this.store.getEcommerceSettings();
    const taxableSubtotal = Decimal.max(new Decimal(0), itemSubtotalBeforeTx.sub(discountDecimal));
    const taxDecimal =
      ecommerceSettings.taxEnabled && !ecommerceSettings.pricesIncludeTax
        ? taxableSubtotal.mul(new Decimal(ecommerceSettings.taxRatePercent).div(100))
        : new Decimal(0);

    const totalAmount = Decimal.max(new Decimal(0), taxableSubtotal.add(taxDecimal).add(shippingDecimal));

    const orderItems = items.map((item, index) => {
      const product = productMap.get(item.productId)!;
      const variant = item.variantId ? variantMap.get(item.variantId) : undefined;
      const custom = customPricing.get(index);
      const unitPrice =
        (promoTerms ? new Decimal(promoTerms.priceCents).div(100) : undefined) ??
        custom?.unitPrice ??
        variant?.priceOverride ??
        getEffectiveProductPrice(product);
      return {
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        unitPrice,
        ...(custom ? { customization: custom.snapshot as Prisma.InputJsonObject } : {}),
      };
    });

    const totalCents = Math.round(totalAmount.mul(100).toNumber());
    const orderPrefix = walletMode === 'none' ? '' : await getOrderPrefix(this.prisma);

    // Create order and reserve inventory atomically in a single transaction
    const order = await this.prisma.$transaction(async (tx) => {
      // Re-validate and reserve stock inside transaction to reduce race conditions.
      // The UPDATE is atomic: it only increments reserved if sufficient stock exists.
      for (const item of items) {
        if (!item.variantId) continue;
        const count = await tx.$executeRaw`
          UPDATE inventory
          SET reserved = reserved + ${item.quantity}
          WHERE "variantId" = ${item.variantId}
            AND "onHand" - reserved >= ${item.quantity}`;
        if (count === 0) {
          // Either no inventory record exists or stock is insufficient
          const inv = await tx.inventory.findUnique({
            where: { variantId: item.variantId },
          });
          const available = inv ? inv.onHand - inv.reserved : 0;
          throw new ConflictException(
            `Insufficient stock for variant ${item.variantId}: ${available} available, ${item.quantity} requested`,
          );
        }
      }

      const order = await tx.order.create({
        data: {
          userId,
          totalAmount,
          currency: 'USD',
          shippingCarrier: dto.shippingCarrier ?? null,
          shippingService: dto.shippingService ?? null,
          shippingAmount: shippingDecimal.gt(0) ? shippingDecimal : null,
          items: { create: orderItems },
          ...(dto.shippingAddress
            ? {
                shippingAddress: {
                  create: {
                    fullName: dto.shippingAddress.fullName,
                    phone: dto.shippingAddress.phone,
                    line1: dto.shippingAddress.line1,
                    line2: dto.shippingAddress.line2 ?? null,
                    city: dto.shippingAddress.city,
                    state: dto.shippingAddress.state,
                    postalCode: dto.shippingAddress.postalCode,
                    country: dto.shippingAddress.country,
                    email: dto.shippingAddress.email,
                  },
                },
              }
            : {}),
        },
        include: { items: { include: { product: true } }, shippingAddress: true },
      });

      await this.astrologyReports.createReportsForOrder(
        tx,
        userId,
        order.id,
        order.items,
        dto.astrologyForms,
      );

      // Checks the client may have the promotion and holds their place; refusing here cancels the whole order.
      if (promoTerms) await this.freeMinutes.reserveClaimForOrder(tx, userId, order.id, options.ip, promoTerms);

      // Wallet money is taken now, so it cannot be spent twice (on a call, say) while PayPal is being paid. It goes back if the
      // order is cancelled or never paid. The take is one conditional update, so the balance can never go below zero.
      let walletAppliedCents = 0;
      if (walletMode !== 'none') {
        const profile = await tx.clientProfile.findUnique({ where: { userId }, select: { id: true, balanceCents: true } });
        const available = profile?.balanceCents ?? 0;
        if (walletMode === 'full' && available < totalCents) {
          throw new BadRequestException('Your wallet balance does not cover this order.');
        }
        walletAppliedCents = Math.min(available, totalCents);
        if (profile && walletAppliedCents > 0) {
          const taken = await tx.clientProfile.updateMany({
            where: { id: profile.id, balanceCents: { gte: walletAppliedCents } },
            data: { balanceCents: { decrement: walletAppliedCents } },
          });
          if (taken.count === 0) throw new ConflictException('Your wallet balance just changed. Please try again.');
          await tx.walletTransaction.create({
            data: {
              userId,
              orderId: order.id,
              type: 'DEBIT',
              amount: walletAppliedCents / 100,
              currency: 'USD',
              description: `Paid from your wallet balance: order ${formatOrderNumber(order.orderNumber, orderPrefix)}`,
            },
          });
          await tx.order.update({ where: { id: order.id }, data: { walletAppliedCents } });
        } else {
          walletAppliedCents = 0;
        }
      }

      return { ...order, walletAppliedCents };
    });

    return order;
  }

  /** Decrement inventory on successful payment (onHand -= qty, reserved -= qty). */
  private async decrementInventory(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return;

    const updates = order.items
      .filter((item) => item.variantId)
      .map((item) =>
        this.prisma.inventory.updateMany({
          where: { variantId: item.variantId! },
          data: {
            onHand: { decrement: item.quantity },
            reserved: { decrement: item.quantity },
          },
        }),
      );

    if (updates.length > 0) {
      await this.prisma.$transaction(updates);
    }
  }

  /** Credits the client's dollar wallet for any wallet top-up (minutesPack-flagged) line items. */
  private async creditWalletIfNeeded(orderId: string, paymentId: string): Promise<number> {
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

    let creditedCents = 0;
    for (const item of order.items) {
      if (item.product.minutesPack > 0) {
        creditedCents += Math.round(Number(item.unitPrice) * 100) * item.quantity;
      }
    }

    if (creditedCents <= 0) {
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
        data: { balanceCents: { increment: creditedCents } },
      }),
      this.prisma.walletTransaction.create({
        data: {
          userId: order.userId,
          paymentId,
          type: 'CREDIT',
          amount: creditedCents / 100,
          currency: order.currency,
          description: `Added $${(creditedCents / 100).toFixed(2)} to wallet via PayPal (order ${order.id})`,
        },
      }),
    ]);

    return creditedCents;
  }

  /** Legacy: create DB order only (plain checkout, no PayPal). */
  async createOrder(userId: string, dto: CreateCheckoutDto, ip?: string) {
    return this.buildOrder(userId, dto, { ip });
  }

  /**
   * PayPal Advanced Checkout – step 1:
   * Create DB order + PayPal order; return paypalOrderId and approval URL. With the wallet option on, the wallet balance pays
   * first and PayPal is asked only for the rest.
   */
  async createPaypalOrder(
    userId: string,
    dto: CreateCheckoutDto,
    ip?: string,
  ): Promise<{
    orderId: string;
    paypalOrderId: string;
    approvalUrl: string;
    walletAppliedCents: number;
  }> {
    const order = await this.buildOrder(userId, dto, { ip, wallet: dto.useWallet ? 'partial' : 'none' });
    const dueCents = Math.round(order.totalAmount.mul(100).toNumber()) - order.walletAppliedCents;
    if (order.walletAppliedCents > 0 && dueCents <= 0) {
      await this.holds.cancelPendingOrder(order.id);
      throw new BadRequestException('Your wallet balance covers this order, so there is nothing to pay through PayPal. Use "Pay from wallet".');
    }

    const webBase =
      this.config.get<string>('WEB_BASE_URL') ?? 'http://localhost:3000';
    const returnUrl = `${webBase}/shop/checkout?success=1&orderId=${order.id}`;
    const cancelUrl = `${webBase}/shop/checkout?cancelled=1&orderId=${order.id}`;

    let created: { paypalOrderId: string; approvalUrl: string };
    try {
      created = await this.paypal.createOrder(order.id, (dueCents / 100).toFixed(2), order.currency, returnUrl, cancelUrl);
    } catch (error) {
      // Nothing was charged: give back the stock, the wallet money and any promotion place the order was holding.
      await this.holds.cancelPendingOrder(order.id);
      throw error;
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: { paypalOrderId: created.paypalOrderId },
    });

    return { orderId: order.id, paypalOrderId: created.paypalOrderId, approvalUrl: created.approvalUrl, walletAppliedCents: order.walletAppliedCents };
  }

  /** Pays for an order entirely from the wallet balance: no PayPal. */
  async createWalletOrder(userId: string, dto: CreateCheckoutDto, ip?: string) {
    const order = await this.buildOrder(userId, dto, { ip, wallet: 'full' });
    if (order.walletAppliedCents <= 0) {
      await this.holds.cancelPendingOrder(order.id);
      throw new BadRequestException('There is nothing to pay from your wallet for this order.');
    }

    await this.prisma.payment.create({
      data: { orderId: order.id, amount: order.totalAmount, currency: order.currency, method: 'WALLET', status: 'SUCCEEDED' },
    });
    await this.prisma.order.update({ where: { id: order.id }, data: { status: 'CONFIRMED' } });

    await this.decrementInventory(order.id);
    await this.astrologyReports.markReportsAwaitingFulfillment(order.id, userId);
    await this.freeMinutes
      .fulfilClaimForOrder(order.id)
      .catch((error: unknown) => this.logger.error(`Could not grant promotion minutes for ${order.id}: ${String(error)}`));
    void this.orderEmails.sendOrderPlaced(order.id);
    void this.cartRecovery.markRecovered(userId).catch(() => undefined);

    return { success: true, orderId: order.id, orderNumber: order.orderNumber, walletAppliedCents: order.walletAppliedCents };
  }

  /**
   * PayPal Advanced Checkout – step 2:
   * Capture the PayPal order; minutes are credited only for COMPLETED captures.
   */
  async capturePaypalOrder(paypalOrderId: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { paypalOrderId, userId },
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
      const creditedCents = await this.creditWalletIfNeeded(order.id, existingPayment.id);
      return {
        success: existingPayment.status === 'SUCCEEDED',
        orderId: order.id,
        paypalOrderId,
        captureId: capture.captureId,
        creditedCents,
      };
    }

    const completed = capture.status === 'COMPLETED';

    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        // What PayPal took: any part of the order paid from the wallet balance is not part of this payment.
        amount: new Decimal(order.totalAmount).sub(new Decimal(order.walletAppliedCents).div(100)),
        currency: order.currency,
        method: 'PAYPAL',
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
        creditedCents: 0,
      };
    }

    await this.decrementInventory(order.id);
    const creditedCents = await this.creditWalletIfNeeded(order.id, payment.id);
    await this.astrologyReports.markReportsAwaitingFulfillment(order.id, userId);
    await this.freeMinutes
      .fulfilClaimForOrder(order.id, capture.payerEmail)
      .catch((error: unknown) => this.logger.error(`Could not grant promotion minutes for ${order.id}: ${String(error)}`));

    // The confirmation to the customer and the alert to the shop owner go out in the background.
    void this.orderEmails.sendOrderPlaced(order.id);
    // They ordered, so no cart reminder is needed.
    void this.cartRecovery.markRecovered(userId).catch(() => undefined);

    return {
      success: true,
      orderId: order.id,
      paypalOrderId,
      captureId: capture.captureId,
      creditedCents,
    };
  }

  /**
   * Cancel a pending order and release inventory reservations.
   * Only PENDING orders can be cancelled this way.
   */
  async cancelOrder(userId: string, orderId: string): Promise<{ orderId: string; status: string }> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.status !== 'PENDING') {
      throw new BadRequestException(
        `Order ${orderId} cannot be cancelled (current status: ${order.status})`,
      );
    }

    // Releases the stock, any wallet money the order took, and any promotion place it held.
    await this.holds.cancelPendingOrder(orderId);

    return { orderId, status: 'CANCELLED' };
  }

  listUserOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        items: { include: { product: true } },
        payments: true,
        shippingAddress: true,
        shipments: { orderBy: { createdAt: 'desc' } },
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
        shippingAddress: true,
        shipments: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    return order;
  }
}

function getEffectiveProductPrice(product: {
  price: Decimal;
  salePrice?: Decimal | null;
  saleStartsAt?: Date | null;
  saleEndsAt?: Date | null;
}) {
  const now = new Date();
  const startsOk = !product.saleStartsAt || product.saleStartsAt <= now;
  const endsOk = !product.saleEndsAt || product.saleEndsAt >= now;
  return product.salePrice && startsOk && endsOk ? product.salePrice : product.price;
}

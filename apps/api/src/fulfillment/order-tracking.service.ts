import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ORDER_NUMBER_OFFSET, customerEmailFor, formatOrderNumber, parseOrderReference } from '@pl-cms/shared';
import { getOrderPrefix } from '../common/order-prefix';
import { PrismaService } from '../prisma/prisma.service';
import { OrderEmailService } from '../mail/order-emails.service';
import { signLink, verifyLink } from '../mail/signed-link';
import { EmailService } from './email.service';
import { ShipStationTrackingService } from './shipstation-tracking.service';
import type { UpdateOrderProgressDto } from './fulfillment.dto';
import {
  TRACKING_NUMBER_PATTERN,
  buildTimeline,
  carrierLabel,
  carrierTrackingUrl,
  normalizeTrackingNumber,
  stageIndex,
  type SettableStage,
} from './order-progress';

const SHIPPED_INDEX = stageIndex('SHIPPED');
/** What the signed tracking link in an order email is for (so it cannot be used for anything else). */
export const TRACKING_LINK_PURPOSE = 'order-tracking';

type LoadedOrder = NonNullable<Awaited<ReturnType<OrderTrackingService['loadOrderWhere']>>>;

@Injectable()
export class OrderTrackingService {
  private readonly logger = new Logger(OrderTrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shipStationTracking: ShipStationTrackingService,
    private readonly email: EmailService,
    private readonly orderEmails: OrderEmailService,
    private readonly config: ConfigService,
  ) {}

  private loadOrder(orderId: string) {
    return this.loadOrderWhere({ id: orderId });
  }

  private loadOrderWhere(where: { id: string } | { orderNumber: number }) {
    return this.prisma.order.findUnique({
      where,
      include: {
        items: { include: { product: { select: { name: true } } } },
        shipments: { orderBy: { createdAt: 'desc' } },
        stageEvents: { orderBy: { createdAt: 'asc' } },
        shippingAddress: true,
        user: { select: { name: true, email: true } },
      },
    });
  }

  // ── Admin: move an order along ──────────────────────────────────────────────────────

  /**
   * Sets where an order is: being made, being packaged, ready to ship, shipped or delivered. "Shipped" needs the provider and the
   * tracking number, which are kept on the order's shipment (so they can be corrected by choosing "Shipped" again).
   */
  async setProgress(orderId: string, dto: UpdateOrderProgressDto) {
    const order = await this.loadOrder(orderId);
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      throw new BadRequestException('This order was cancelled or refunded, so it has no progress to update.');
    }
    if (order.status === 'PENDING') {
      throw new BadRequestException('This order has not been paid yet. Update its progress once payment is received.');
    }

    const timeline = buildTimeline({
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      status: order.status,
      events: order.stageEvents,
      shipments: order.shipments,
    });
    const alreadyShipped = stageIndex(timeline.currentStage) >= SHIPPED_INDEX;
    const target: SettableStage = dto.stage;
    if (alreadyShipped && stageIndex(target) < SHIPPED_INDEX) {
      throw new BadRequestException('This order has already shipped. Choose "Shipped" to change the tracking details, or "Delivered".');
    }

    let carrierValue = '';
    let trackingNumber = '';
    if (target === 'SHIPPED') {
      if (!dto.carrier) throw new BadRequestException('Choose the shipping provider.');
      carrierValue = dto.carrier === 'other' ? (dto.carrierName ?? '').trim() : dto.carrier;
      if (!carrierValue) throw new BadRequestException('Type the name of the shipping provider.');
      trackingNumber = normalizeTrackingNumber(dto.trackingNumber ?? '');
      if (!TRACKING_NUMBER_PATTERN.test(trackingNumber)) {
        throw new BadRequestException('Enter the tracking number (letters, numbers and dashes, at least 5 characters).');
      }
    }

    const activeShipment = order.shipments.find((shipment) => shipment.status !== 'CANCELLED') ?? null;
    const now = new Date();
    const changesStage = timeline.currentStage !== target;

    await this.prisma.$transaction(async (tx) => {
      if (changesStage) await tx.orderStageEvent.create({ data: { orderId, stage: target } });

      if (target === 'SHIPPED') {
        if (activeShipment) {
          await tx.shipment.update({
            where: { id: activeShipment.id },
            data: {
              carrier: carrierValue,
              trackingNumber,
              status: 'SHIPPED',
              shippedAt: activeShipment.shippedAt ?? now,
              deliveredAt: null,
            },
          });
        } else {
          await tx.shipment.create({
            data: { orderId, carrier: carrierValue, trackingNumber, status: 'SHIPPED', shippedAt: now },
          });
        }
        await tx.order.update({ where: { id: orderId }, data: { status: 'SHIPPED' } });
      } else if (target === 'DELIVERED') {
        if (activeShipment) {
          await tx.shipment.update({
            where: { id: activeShipment.id },
            data: { status: 'DELIVERED', shippedAt: activeShipment.shippedAt ?? now, deliveredAt: now },
          });
        }
        await tx.order.update({ where: { id: orderId }, data: { status: 'COMPLETED' } });
      } else if (order.status === 'CONFIRMED') {
        await tx.order.update({ where: { id: orderId }, data: { status: 'PROCESSING' } });
      }
    });

    // The customer's emails go out in the background (a mail server can take a few seconds); they never throw.
    if (target === 'SHIPPED' && !alreadyShipped) {
      void this.email.sendShipmentNotification({
        to: customerEmailFor(order.shippingAddress?.email, order.user.email),
        customerName: order.user.name,
        orderId: order.id,
        trackingNumber,
        carrier: carrierLabel(carrierValue),
      });
    } else if (changesStage && (target === 'IN_PRODUCTION' || target === 'PACKAGING' || target === 'READY_TO_SHIP')) {
      void this.orderEmails.sendProgress(orderId, target);
    }

    // No carrier lookup here: saving should be quick, and the page that shows the order asks for it.
    return this.getTracking({ id: '', role: 'ADMIN' }, orderId, { includeLive: false });
  }

  // ── What a customer (or an admin) sees ──────────────────────────────────────────────

  async getTracking(viewer: { id: string; role: string }, orderId: string, options: { includeLive?: boolean } = {}) {
    const isStaff = viewer.role === 'ADMIN' || viewer.role === 'EDITOR';
    const order = await this.loadOrder(orderId);
    // The same answer for "no such order" and "someone else's order", so order ids cannot be probed.
    if (!order || (!isStaff && order.userId !== viewer.id)) throw new NotFoundException('Order not found');
    return this.present(order, options);
  }

  /**
   * "Where is my order?" by order number (PL-1042, 1042, or an older link's long id). Allowed for staff, for the signed-in
   * customer who placed it, for a signed link from the order's own email, or when the email address on the order is given.
   * Any other case gets the same answer as "no such order", so numbers cannot be used to find out what exists.
   */
  async lookup(viewer: { id: string; role: string } | null, dto: { order: string; email?: string; token?: string }) {
    const notFound = new NotFoundException(
      'We could not find an order with that number. Check the number, and that you typed the email address used for the order.',
    );
    const reference = parseOrderReference(dto.order);
    if (!reference) throw notFound;
    const order = await this.loadOrderWhere('orderNumber' in reference ? { orderNumber: reference.orderNumber } : { id: reference.id });
    if (!order || !this.mayView(order, viewer, dto)) throw notFound;
    return this.present(order);
  }

  /** The link in an order email: signed with a secret only this site knows, so it works without logging in. */
  trackingToken(orderId: string): string {
    const secret = this.signingSecret();
    return secret ? signLink(TRACKING_LINK_PURPOSE, orderId, secret) : '';
  }

  private signingSecret() {
    return this.config.get<string>('JWT_REFRESH_SECRET') || this.config.get<string>('DOCUMENT_ENCRYPTION_KEY') || '';
  }

  private mayView(order: LoadedOrder, viewer: { id: string; role: string } | null, dto: { email?: string; token?: string }) {
    if (viewer && (viewer.role === 'ADMIN' || viewer.role === 'EDITOR' || viewer.id === order.userId)) return true;
    if (dto.token && verifyLink(TRACKING_LINK_PURPOSE, order.id, dto.token, this.signingSecret())) return true;
    const given = dto.email?.trim().toLowerCase();
    if (!given) return false;
    return [order.shippingAddress?.email, order.user.email, order.payerEmail].some((address) => address?.trim().toLowerCase() === given);
  }

  private async present(order: LoadedOrder, options: { includeLive?: boolean } = {}) {
    const build = (current: LoadedOrder) =>
      buildTimeline({
        createdAt: current.createdAt,
        updatedAt: current.updatedAt,
        status: current.status,
        events: current.stageEvents,
        shipments: current.shipments,
      });
    let timeline = build(order);

    const shipment = order.shipments.find((entry) => entry.status !== 'CANCELLED' && entry.trackingNumber) ?? null;
    let live = null;
    let liveStatus: 'not_configured' | 'unsupported' | 'unavailable' | null = null;

    if (options.includeLive !== false && shipment?.trackingNumber && !timeline.closed && stageIndex(timeline.currentStage) >= SHIPPED_INDEX) {
      const lookup = await this.shipStationTracking.lookup(shipment.carrier, shipment.trackingNumber);
      live = lookup.live;
      liveStatus = lookup.unavailable ?? null;

      // The carrier says it arrived: record it, so the order shows as delivered without anyone having to.
      if (live?.delivered && timeline.currentStage === 'SHIPPED') {
        try {
          await this.markDelivered(order.id, shipment.id, live.deliveredAt ? new Date(live.deliveredAt) : new Date());
          const refreshed = await this.loadOrder(order.id);
          if (refreshed) {
            order = refreshed;
            timeline = build(refreshed);
          }
        } catch (error) {
          this.logger.warn(`Could not mark order ${order.id} delivered: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    const prefix = await getOrderPrefix(this.prisma);
    return {
      orderId: order.id,
      orderNumber: order.orderNumber + ORDER_NUMBER_OFFSET,
      orderLabel: formatOrderNumber(order.orderNumber, prefix),
      placedAt: order.createdAt.toISOString(),
      status: order.status,
      timeline,
      shipment: shipment
        ? {
            carrier: carrierLabel(shipment.carrier),
            trackingNumber: shipment.trackingNumber,
            trackingUrl: shipment.trackingNumber ? carrierTrackingUrl(shipment.carrier, shipment.trackingNumber) : null,
            shippedAt: shipment.shippedAt?.toISOString() ?? null,
            deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
          }
        : null,
      live,
      liveStatus,
      items: order.items.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        summary: customizationSummary(item.customization),
      })),
    };
  }

  private async markDelivered(orderId: string, shipmentId: string, at: Date) {
    await this.prisma.$transaction(async (tx) => {
      await tx.orderStageEvent.create({ data: { orderId, stage: 'DELIVERED', createdAt: at } });
      await tx.shipment.update({ where: { id: shipmentId }, data: { status: 'DELIVERED', deliveredAt: at } });
      await tx.order.update({ where: { id: orderId }, data: { status: 'COMPLETED' } });
    });
  }
}

function customizationSummary(customization: unknown): string | null {
  if (!customization || typeof customization !== 'object') return null;
  const summary = (customization as { summary?: unknown }).summary;
  return typeof summary === 'string' && summary.trim() ? summary.trim() : null;
}

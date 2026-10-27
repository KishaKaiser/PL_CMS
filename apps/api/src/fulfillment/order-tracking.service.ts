import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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

@Injectable()
export class OrderTrackingService {
  private readonly logger = new Logger(OrderTrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shipStationTracking: ShipStationTrackingService,
    private readonly email: EmailService,
  ) {}

  private loadOrder(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
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

    if (target === 'SHIPPED' && !alreadyShipped) {
      await this.email.sendShipmentNotification({
        to: order.shippingAddress?.email ?? order.user.email,
        customerName: order.user.name,
        orderId: order.id,
        trackingNumber,
        carrier: carrierLabel(carrierValue),
      });
    }

    // No carrier lookup here: saving should be quick, and the page that shows the order asks for it.
    return this.getTracking({ id: '', role: 'ADMIN' }, orderId, { includeLive: false });
  }

  // ── What a customer (or an admin) sees ──────────────────────────────────────────────

  async getTracking(viewer: { id: string; role: string }, orderId: string, options: { includeLive?: boolean } = {}) {
    const isStaff = viewer.role === 'ADMIN' || viewer.role === 'EDITOR';
    let order = await this.loadOrder(orderId);
    // The same answer for "no such order" and "someone else's order", so order ids cannot be probed.
    if (!order || (!isStaff && order.userId !== viewer.id)) throw new NotFoundException('Order not found');

    const build = (current: NonNullable<typeof order>) =>
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
          const refreshed = await this.loadOrder(orderId);
          if (refreshed) {
            order = refreshed;
            timeline = build(refreshed);
          }
        } catch (error) {
          this.logger.warn(`Could not mark order ${order.id} delivered: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    return {
      orderId: order.id,
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

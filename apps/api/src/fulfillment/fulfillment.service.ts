import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BuyLabelDto, UpdateShipmentStatusDto } from './fulfillment.dto';
import { EmailService } from './email.service';

const SHIPSTATION_BASE = 'https://ssapi.shipstation.com';
const DEFAULT_ITEM_WEIGHT_OZ = 16;

interface ShipStationLabelResponse {
  shipmentId?: number;
  trackingNumber?: string;
  labelData?: string;    // base64 encoded label PDF/PNG
  labelUrl?: string;
  cost?: number;
  carrier?: string;
  service?: string;
  shipDate?: string;
}

@Injectable()
export class FulfillmentService {
  private readonly logger = new Logger(FulfillmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  private getAuthHeader(): string {
    const key = this.config.get<string>('SHIPSTATION_API_KEY') ?? '';
    const secret = this.config.get<string>('SHIPSTATION_API_SECRET') ?? '';
    if (!key || !secret) {
      throw new BadRequestException(
        'ShipStation API credentials are not configured. ' +
          'Set SHIPSTATION_API_KEY and SHIPSTATION_API_SECRET.',
      );
    }
    return 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64');
  }

  /** Admin: list all orders with optional status filter and search. */
  async listOrders(opts: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, search, page = 1, limit = 20 } = opts;
    const skip = (page - 1) * limit;

    const statusCondition = status ? { status: status as never } : {};
    const searchCondition = search
      ? {
          OR: [
            { id: { contains: search, mode: 'insensitive' as const } },
            { payerEmail: { contains: search, mode: 'insensitive' as const } },
            {
              shippingAddress: {
                fullName: { contains: search, mode: 'insensitive' as const },
              },
            },
            {
              user: {
                email: { contains: search, mode: 'insensitive' as const },
              },
            },
          ],
        }
      : {};

    const where = { ...statusCondition, ...searchCondition };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, type: true } },
              variant: { select: { id: true, color: true, sku: true } },
            },
          },
          shippingAddress: true,
          shipments: true,
          payments: { select: { id: true, status: true, amount: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { orders, total, page, limit };
  }

  /** Admin: get a single order with full detail. */
  async getOrderById(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, email: true, name: true } },
        items: {
          include: {
            product: true,
            variant: { include: { inventory: true } },
          },
        },
        shippingAddress: true,
        shipments: { orderBy: { createdAt: 'desc' } },
        payments: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    return order;
  }

  /**
   * Admin: buy a ShipStation shipping label for an order.
   * Creates a Shipment record and emails the customer.
   */
  async buyLabel(orderId: string, dto: BuyLabelDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        shippingAddress: true,
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
        user: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (!['CONFIRMED', 'PROCESSING'].includes(order.status)) {
      throw new BadRequestException(
        `Order ${orderId} is not in a fulfillable status (current: ${order.status})`,
      );
    }

    if (!order.shippingAddress) {
      throw new BadRequestException(
        `Order ${orderId} has no shipping address. Cannot purchase label.`,
      );
    }

    // Retrieve warehouse/origin address
    const warehouseSetting = await this.prisma.setting.findUnique({
      where: { key: 'warehouse_address' },
    });
    if (!warehouseSetting) {
      throw new BadRequestException(
        'Warehouse origin address is not configured. Please set it in Admin → Settings → Shipping.',
      );
    }

    const warehouse = JSON.parse(warehouseSetting.value) as {
      fullName: string;
      phone: string;
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };

    const addr = order.shippingAddress;
    const totalWeightOz = order.items.reduce((sum, item) => sum + DEFAULT_ITEM_WEIGHT_OZ * item.quantity, 0);

    const labelRequest = {
      carrierCode: dto.carrierCode,
      serviceCode: dto.serviceCode,
      packageCode: 'package',
      confirmation: 'none',
      shipDate: new Date().toISOString().split('T')[0],
      weight: { value: totalWeightOz, units: 'ounces' },
      dimensions: null,
      shipFrom: {
        name: warehouse.fullName,
        phone: warehouse.phone,
        street1: warehouse.line1,
        street2: warehouse.line2 ?? null,
        city: warehouse.city,
        state: warehouse.state,
        postalCode: warehouse.postalCode,
        country: warehouse.country,
        residential: false,
      },
      shipTo: {
        name: addr.fullName,
        phone: addr.phone,
        street1: addr.line1,
        street2: addr.line2 ?? null,
        city: addr.city,
        state: addr.state,
        postalCode: addr.postalCode,
        country: addr.country,
        residential: true,
      },
      testLabel: this.config.get<string>('NODE_ENV') !== 'production',
    };

    const authHeader = this.getAuthHeader();
    const response = await fetch(`${SHIPSTATION_BASE}/shipments/createlabel`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(labelRequest),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.warn(`ShipStation createlabel failed: ${response.status} ${text}`);
      throw new BadRequestException(
        `ShipStation returned an error (${response.status}). Check your API credentials and order details.`,
      );
    }

    const labelData = (await response.json()) as ShipStationLabelResponse;

    // Create shipment record and update order status
    const shipment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.shipment.create({
        data: {
          orderId,
          shipstationShipmentId: labelData.shipmentId?.toString() ?? null,
          carrier: dto.carrierCode,
          service: dto.serviceCode,
          trackingNumber: labelData.trackingNumber ?? null,
          labelUrl: labelData.labelUrl ?? null,
          status: 'LABEL_PURCHASED',
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: { status: 'PROCESSING' },
      });

      return created;
    });

    // Send email notification (best-effort)
    const customerEmail = order.shippingAddress?.email ?? order.user.email;
    await this.email.sendShipmentNotification({
      to: customerEmail,
      customerName: order.user.name,
      orderId,
      trackingNumber: labelData.trackingNumber,
      carrier: dto.carrierCode,
      labelUrl: labelData.labelUrl,
    });

    return shipment;
  }

  /**
   * Admin: update a shipment's status.
   * Also updates the parent order's status accordingly.
   */
  async updateShipmentStatus(shipmentId: string, dto: UpdateShipmentStatusDto) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { order: { include: { items: true, shippingAddress: true, user: true } } },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment ${shipmentId} not found`);
    }

    const now = new Date();
    const shipmentUpdate: {
      status: 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
      trackingNumber?: string;
      shippedAt?: Date;
      deliveredAt?: Date;
    } = { status: dto.status };

    if (dto.trackingNumber) {
      shipmentUpdate.trackingNumber = dto.trackingNumber;
    }
    if (dto.status === 'SHIPPED') {
      shipmentUpdate.shippedAt = now;
    }
    if (dto.status === 'DELIVERED') {
      shipmentUpdate.deliveredAt = now;
    }

    // Map shipment status → order status
    const orderStatusMap: Record<string, 'SHIPPED' | 'COMPLETED' | 'CANCELLED'> = {
      SHIPPED: 'SHIPPED',
      DELIVERED: 'COMPLETED',
      CANCELLED: 'CANCELLED',
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedShipment = await tx.shipment.update({
        where: { id: shipmentId },
        data: shipmentUpdate,
      });

      const newOrderStatus = orderStatusMap[dto.status];
      if (newOrderStatus) {
        await tx.order.update({
          where: { id: shipment.orderId },
          data: { status: newOrderStatus },
        });
      }

      // Restock inventory when order is cancelled
      if (dto.status === 'CANCELLED') {
        const variantItems = shipment.order.items.filter((i) => i.variantId);
        for (const item of variantItems) {
          await tx.inventory.updateMany({
            where: { variantId: item.variantId! },
            data: { onHand: { increment: item.quantity } },
          });
        }
      }

      return updatedShipment;
    });

    // Send shipped notification
    if (dto.status === 'SHIPPED') {
      const customerEmail =
        shipment.order.shippingAddress?.email ?? shipment.order.user.email;
      await this.email.sendShipmentNotification({
        to: customerEmail,
        customerName: shipment.order.user.name,
        orderId: shipment.orderId,
        trackingNumber: dto.trackingNumber ?? shipment.trackingNumber,
        carrier: shipment.carrier,
      });
    }

    return updated;
  }
}

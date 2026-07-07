import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OrderStatus, Prisma } from '@pl-cms/db';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';

const CUSTOM_STORE_SETTINGS_KEY = 'shipstation_custom_store_settings';
const SHIPPING_API_SETTINGS_KEY = 'shipping_api_settings';
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_ITEM_WEIGHT_OZ = 16;

interface CustomStoreSettings {
  username?: string;
  password?: string;
}

interface ExportOrdersOptions {
  startDate?: string;
  endDate?: string;
  page?: string;
  baseUrl: string;
}

interface ShipNotifyOptions {
  orderNumber?: string;
  orderId?: string;
  carrier?: string;
  service?: string;
  trackingNumber?: string;
}

@Injectable()
export class ShipStationCustomStoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  async getConnectionInfo(baseUrl: string) {
    const settings = await this.getCustomStoreSettings();
    return {
      endpointUrl: `${baseUrl}/api/shipstation/custom-store`,
      usernameConfigured: Boolean(settings.username),
      passwordConfigured: Boolean(settings.password),
      authentication: 'Basic HTTP Authentication',
    };
  }

  async upsertConnectionSettings(settings: CustomStoreSettings) {
    const sanitized = {
      username: settings.username?.trim() ?? '',
      password: settings.password?.trim() ?? '',
    };
    await this.prisma.setting.upsert({
      where: { key: CUSTOM_STORE_SETTINGS_KEY },
      create: { key: CUSTOM_STORE_SETTINGS_KEY, value: JSON.stringify(sanitized) },
      update: { value: JSON.stringify(sanitized) },
    });
    return {
      usernameConfigured: Boolean(sanitized.username),
      passwordConfigured: Boolean(sanitized.password),
    };
  }

  async assertAuthorized(authorizationHeader?: string) {
    const settings = await this.getCustomStoreSettings();
    const username = settings.username || this.config.get<string>('SHIPSTATION_CUSTOM_STORE_USERNAME') || '';
    const password = settings.password || this.config.get<string>('SHIPSTATION_CUSTOM_STORE_PASSWORD') || '';

    if (!username || !password) {
      throw new UnauthorizedException('ShipStation custom store credentials are not configured.');
    }

    const credentials = parseBasicAuth(authorizationHeader);
    if (!credentials || credentials.username !== username || credentials.password !== password) {
      throw new UnauthorizedException('Invalid ShipStation custom store credentials.');
    }
  }

  async exportOrders(options: ExportOrdersOptions) {
    const startDate = parseShipStationDate(options.startDate);
    const endDate = parseShipStationDate(options.endDate);
    const page = Math.max(1, Number.parseInt(options.page ?? '1', 10) || 1);
    const skip = (page - 1) * DEFAULT_PAGE_SIZE;

    const exportStatuses: OrderStatus[] = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'REFUNDED'];
    const where: Prisma.OrderWhereInput = {
      status: { in: exportStatuses },
      shippingAddress: { isNot: null },
      items: { some: { product: { type: 'PHYSICAL' as const } } },
      ...(startDate || endDate
        ? {
            updatedAt: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          user: true,
          shippingAddress: true,
          items: {
            include: {
              product: true,
              variant: true,
            },
          },
          payments: { where: { status: 'SUCCEEDED' }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { updatedAt: 'asc' },
        skip,
        take: DEFAULT_PAGE_SIZE,
      }) as Promise<OrderExportRecord[]>,
      this.prisma.order.count({ where }),
    ]);

    const pages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));
    return [
      '<?xml version="1.0" encoding="utf-8"?>',
      `<Orders pages="${pages}">`,
      ...orders.map((order) => this.renderOrder(order, options.baseUrl)),
      '</Orders>',
    ].join('');
  }

  async handleShipNotify(options: ShipNotifyOptions) {
    const orderNumber = options.orderNumber || options.orderId;
    if (!orderNumber) throw new BadRequestException('order_number is required.');

    const order = await this.prisma.order.findUnique({
      where: { id: orderNumber },
      include: { shippingAddress: true, user: true },
    });
    if (!order) throw new BadRequestException(`Order ${orderNumber} was not found.`);

    const trackingNumber = options.trackingNumber?.trim() || null;
    const carrier = options.carrier?.trim() || null;
    const service = options.service?.trim() || null;
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const existingShipment = trackingNumber
        ? await tx.shipment.findFirst({ where: { orderId: order.id, trackingNumber } })
        : null;

      if (existingShipment) {
        await tx.shipment.update({
          where: { id: existingShipment.id },
          data: {
            carrier,
            service,
            trackingNumber,
            status: 'SHIPPED',
            shippedAt: existingShipment.shippedAt ?? now,
          },
        });
      } else {
        await tx.shipment.create({
          data: {
            orderId: order.id,
            carrier,
            service,
            trackingNumber,
            status: 'SHIPPED',
            shippedAt: now,
          },
        });
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: 'SHIPPED' },
      });
    });

    await this.email.sendShipmentNotification({
      to: order.shippingAddress?.email ?? order.user.email,
      customerName: order.user.name,
      orderId: order.id,
      trackingNumber,
      carrier,
    });

    return '<?xml version="1.0" encoding="utf-8"?><ShipNoticeReceived>true</ShipNoticeReceived>';
  }

  private async getCustomStoreSettings(): Promise<CustomStoreSettings> {
    const setting = await this.prisma.setting.findUnique({ where: { key: CUSTOM_STORE_SETTINGS_KEY } });
    if (!setting) return {};
    try {
      const parsed = JSON.parse(setting.value) as unknown;
      if (!parsed || typeof parsed !== 'object') return {};
      const candidate = parsed as Record<string, unknown>;
      return {
        username: typeof candidate.username === 'string' ? candidate.username.trim() : '',
        password: typeof candidate.password === 'string' ? candidate.password.trim() : '',
      };
    } catch {
      return {};
    }
  }

  private renderOrder(order: OrderExportRecord, baseUrl: string) {
    const address = order.shippingAddress;
    if (!address) return '';
    const payment = order.payments[0];
    const shippingAmount = Number(order.shippingAmount ?? 0);
    const itemSubtotal = order.items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
    const taxAmount = Math.max(0, Number(order.totalAmount) - itemSubtotal - shippingAmount);

    return [
      '<Order>',
      xmlCdata('OrderID', order.id),
      xmlCdata('OrderNumber', order.id),
      xmlText('OrderDate', formatShipStationDate(order.createdAt)),
      xmlCdata('OrderStatus', mapOrderStatus(order.status)),
      xmlText('LastModified', formatShipStationDate(order.updatedAt)),
      xmlCdata('ShippingMethod', order.shippingService ?? ''),
      xmlCdata('PaymentMethod', payment?.method ?? ''),
      xmlText('CurrencyCode', order.currency),
      xmlText('OrderTotal', money(order.totalAmount)),
      xmlText('TaxAmount', money(taxAmount)),
      xmlText('ShippingAmount', money(shippingAmount)),
      xmlCdata('CustomerNotes', ''),
      xmlCdata('InternalNotes', ''),
      xmlText('Gift', 'false'),
      xmlCdata('GiftMessage', ''),
      '<Customer>',
      xmlCdata('CustomerCode', order.user.email),
      '<BillTo>',
      xmlCdata('Name', order.user.name),
      xmlCdata('Company', ''),
      xmlCdata('Phone', address.phone),
      xmlCdata('Email', order.payerEmail ?? address.email ?? order.user.email),
      '</BillTo>',
      '<ShipTo>',
      xmlCdata('Name', address.fullName),
      xmlCdata('Company', ''),
      xmlCdata('Address1', address.line1),
      xmlCdata('Address2', address.line2 ?? ''),
      xmlCdata('City', address.city),
      xmlCdata('State', address.state),
      xmlCdata('PostalCode', address.postalCode),
      xmlCdata('Country', address.country),
      xmlCdata('Phone', address.phone),
      '</ShipTo>',
      '</Customer>',
      '<Items>',
      ...order.items.map((item) => renderItem(item, baseUrl)),
      '</Items>',
      '</Order>',
    ].join('');
  }
}

type OrderExportRecord = Prisma.OrderGetPayload<{
  include: {
    user: true;
    shippingAddress: true;
    items: { include: { product: true; variant: true } };
    payments: true;
  };
}>;

function renderItem(item: OrderExportRecord['items'][number], baseUrl: string) {
  const variantName = item.variant ? ` - ${item.variant.color}` : '';
  return [
    '<Item>',
    xmlCdata('SKU', item.variant?.sku ?? item.product.id),
    xmlCdata('Name', `${item.product.name}${variantName}`),
    xmlCdata('ImageUrl', absoluteUrl(item.variant?.imageUrl || item.product.imageUrl || '', baseUrl)),
    xmlText('Weight', money(item.product.weightOz ?? DEFAULT_ITEM_WEIGHT_OZ)),
    xmlText('WeightUnits', 'Ounces'),
    xmlText('Quantity', String(item.quantity)),
    xmlText('UnitPrice', money(item.unitPrice)),
    xmlCdata('UPC', ''),
    xmlCdata('Location', ''),
    '</Item>',
  ].join('');
}

function parseBasicAuth(header?: string) {
  if (!header?.toLowerCase().startsWith('basic ')) return null;
  const encoded = header.slice(6).trim();
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex < 0) return null;
  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
}

function parseShipStationDate(value?: string) {
  if (!value) return undefined;
  const decoded = decodeURIComponent(value).trim();
  const match = decoded.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) {
    const fallback = new Date(decoded);
    return Number.isNaN(fallback.getTime()) ? undefined : fallback;
  }
  const [, month, day, year, hour, minute, meridiem] = match;
  let normalizedHour = Number(hour);
  if (meridiem?.toUpperCase() === 'PM' && normalizedHour < 12) normalizedHour += 12;
  if (meridiem?.toUpperCase() === 'AM' && normalizedHour === 12) normalizedHour = 0;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), normalizedHour, Number(minute)));
}

function formatShipStationDate(date: Date) {
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${month}/${day}/${year} ${hours}:${minutes}`;
}

function mapOrderStatus(status: string) {
  if (status === 'SHIPPED' || status === 'COMPLETED') return 'shipped';
  if (status === 'CANCELLED' || status === 'REFUNDED') return 'cancelled';
  return 'paid';
}

function xmlText(tag: string, value: unknown) {
  return `<${tag}>${escapeXml(String(value ?? ''))}</${tag}>`;
}

function xmlCdata(tag: string, value: unknown) {
  return `<${tag}><![CDATA[${String(value ?? '').replaceAll(']]>', ']]]]><![CDATA[>')}]]></${tag}>`;
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function money(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : '0.00';
}

function absoluteUrl(value: string, baseUrl: string) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `${baseUrl}${value.startsWith('/') ? '' : '/'}${value}`;
}

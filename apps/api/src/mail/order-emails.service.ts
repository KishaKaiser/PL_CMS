import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { formatOrderNumber } from '@pl-cms/shared';
import { getOrderPrefix } from '../common/order-prefix';
import { PrismaService } from '../prisma/prisma.service';
import { ORDER_STAGE_STEPS, carrierLabel } from '../fulfillment/order-progress';
import { EmailComposer } from './email-composer';
import { EmailSettingsService } from './email-settings.service';
import { MailService } from './mail.service';
import { signLink } from './signed-link';

type LoadedOrder = NonNullable<Awaited<ReturnType<OrderEmailService['loadOrder']>>>;

/**
 * The emails about an order: the confirmation and the progress updates to the customer, the shipping notice, and the
 * "new order" alert to the shop owner. The wording comes from the editable templates and the look from the Email page.
 * Every method is safe to call without waiting: it never throws, and when email is not set up or a template is switched
 * off it simply does nothing.
 */
@Injectable()
export class OrderEmailService {
  private readonly logger = new Logger(OrderEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly settings: EmailSettingsService,
    private readonly composer: EmailComposer,
    private readonly config: ConfigService,
  ) {}

  private loadOrder(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { name: true, email: true } },
        shippingAddress: true,
        items: { include: { product: { select: { name: true, type: true } } } },
      },
    });
  }

  private async siteName() {
    try {
      const row = await this.prisma.setting.findUnique({ where: { key: 'site_identity' } });
      const title = row?.value ? (JSON.parse(row.value) as { title?: unknown }).title : '';
      return typeof title === 'string' && title.trim() ? title.trim() : '';
    } catch {
      return '';
    }
  }

  /**
   * The link in an email to the tracking page, by order number. It carries a signature made with this site's secret, so the
   * customer sees their order without logging in, and nobody else can make a link to it.
   */
  private async trackingUrl(order: LoadedOrder, label: string) {
    const base = await this.settings.siteUrl();
    if (!base) return '';
    const secret = this.config.get<string>('JWT_REFRESH_SECRET') || this.config.get<string>('DOCUMENT_ENCRYPTION_KEY') || '';
    const token = secret ? `&token=${signLink('order-tracking', order.id, secret)}` : '';
    return `${base}/track-order?order=${encodeURIComponent(label)}${token}`;
  }

  private async values(order: LoadedOrder, extra: Record<string, string> = {}) {
    const label = formatOrderNumber(order.orderNumber, await getOrderPrefix(this.prisma));
    const items = order.items
      .map((item) => {
        const summary = (item.customization as { summary?: unknown } | null)?.summary;
        const line = `• ${item.quantity} × ${item.product.name}${typeof summary === 'string' && summary.trim() ? ` (${summary.trim()})` : ''}`;
        return `${line} — ${formatMoney(Number(item.unitPrice) * item.quantity, order.currency)}`;
      })
      .join('\n');
    const address = order.shippingAddress;
    return {
      customerName: address?.fullName || order.user.name || 'there',
      customerEmail: this.customerAddress(order),
      // The order number customers know (PL-1042), not the long internal id.
      orderId: label,
      orderShort: label,
      trackingUrl: await this.trackingUrl(order, label),
      orderItems: items,
      total: formatMoney(Number(order.totalAmount), order.currency),
      shipTo: address
        ? [address.fullName, address.line1, address.line2, `${address.city}, ${address.state} ${address.postalCode}`, address.country].filter(Boolean).join('\n')
        : 'No shipping address (nothing to ship)',
      ...extra,
    } as Record<string, string>;
  }

  private customerAddress(order: LoadedOrder) {
    return order.shippingAddress?.email || order.user.email;
  }

  private async defaultFooter() {
    const name = await this.siteName();
    return name ? `You are receiving this because you placed an order at ${name}.` : 'You are receiving this because you placed an order.';
  }

  /** The confirmation to the customer and the alert to the owner, once an order has been paid. */
  async sendOrderPlaced(orderId: string): Promise<void> {
    try {
      const order = await this.loadOrder(orderId);
      if (!order) return;
      // Adding funds to the wallet is not a shop order the customer needs a confirmation for.
      if (order.items.length > 0 && order.items.every((item) => item.product.type === 'MINUTE_PACK')) return;
      // Not set up: do nothing, and leave the order unmarked so it is not skipped later.
      if (!(await this.mail.isConfigured())) return;
      // Payment can be confirmed more than once (the checkout page and PayPal's webhook): only the first one sends.
      const claimed = await this.prisma.order.updateMany({
        where: { id: orderId, confirmationEmailSentAt: null },
        data: { confirmationEmailSentAt: new Date() },
      });
      if (claimed.count === 0) return;

      const [emailSettings, defaultFooter, base, values] = await Promise.all([
        this.settings.get(),
        this.defaultFooter(),
        this.settings.siteUrl(),
        this.values(order),
      ]);
      const trackingUrl = values.trackingUrl;

      const confirmation = await this.composer.compose('order_confirmation', values, {
        customer: true,
        button: trackingUrl ? { url: trackingUrl } : null,
        defaultFooter,
      });
      if (confirmation?.enabled) {
        await this.mail.send({ to: this.customerAddress(order), subject: confirmation.subject, html: confirmation.html, text: confirmation.text }, { kind: 'order-confirmation' });
      }

      if (emailSettings.notifyOnOrders) {
        const alertTo = await this.settings.alertAddress();
        const alert = alertTo
          ? await this.composer.compose('order_alert', values, {
              customer: false,
              button: base ? { url: `${base}/admin/orders/${order.id}`, label: 'Open the order' } : null,
            })
          : null;
        if (alertTo && alert) {
          await this.mail.send({ to: alertTo, subject: alert.subject, html: alert.html, text: alert.text }, { kind: 'order-alert' });
        }
      }
    } catch (error) {
      this.logger.warn(`Order confirmation for ${orderId} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** "Your order is now being made / packaged / ready to ship". */
  async sendProgress(orderId: string, stage: string): Promise<void> {
    try {
      const order = await this.loadOrder(orderId);
      if (!order) return;
      const stageLabel = ORDER_STAGE_STEPS.find((step) => step.key === stage)?.label;
      if (!stageLabel) return;

      const defaultFooter = await this.defaultFooter();
      const values = await this.values(order, { stage: stageLabel.toLowerCase() });
      const trackingUrl = values.trackingUrl;
      const email = await this.composer.compose('order_progress', values, {
        customer: true,
        button: trackingUrl ? { url: trackingUrl } : null,
        defaultFooter,
      });
      if (!email?.enabled) return;
      await this.mail.send({ to: this.customerAddress(order), subject: email.subject, html: email.html, text: email.text }, { kind: 'order-progress' });
    } catch (error) {
      this.logger.warn(`Progress email for ${orderId} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** The shipping notice, with the provider, tracking number and a link to the tracking page. */
  async sendShipped(options: { orderId: string; to?: string; trackingNumber?: string | null; carrier?: string | null }): Promise<void> {
    try {
      const order = await this.loadOrder(options.orderId);
      if (!order) return;

      const defaultFooter = await this.defaultFooter();
      const values = await this.values(order, { trackingNumber: options.trackingNumber ?? '', carrier: carrierLabel(options.carrier) || 'the carrier' });
      const trackingUrl = values.trackingUrl;
      const email = await this.composer.compose('order_shipped', values, {
        customer: true,
        button: trackingUrl ? { url: trackingUrl } : null,
        defaultFooter,
      });
      if (!email?.enabled) return;
      await this.mail.send({ to: options.to || this.customerAddress(order), subject: email.subject, html: email.html, text: email.text }, { kind: 'order-shipped' });
    } catch (error) {
      this.logger.warn(`Shipping email for ${options.orderId} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function formatMoney(amount: number, currency: string) {
  const value = Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
  return currency === 'USD' ? `$${value}` : `${value} ${currency}`;
}

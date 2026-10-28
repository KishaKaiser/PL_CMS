import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ORDER_STAGE_STEPS, carrierLabel } from '../fulfillment/order-progress';
import { EmailSettingsService } from './email-settings.service';
import { fillTemplate, loadEmailTemplates } from './email-templates';
import { renderEmail } from './email-layout';
import { MailService } from './mail.service';

type LoadedOrder = NonNullable<Awaited<ReturnType<OrderEmailService['loadOrder']>>>;

/**
 * The emails about an order: the confirmation and the progress updates to the customer, the shipping notice, and the
 * "new order" alert to the shop owner. Every method is safe to call without waiting: it never throws, and when email is not
 * set up or a template is switched off it simply does nothing.
 */
@Injectable()
export class OrderEmailService {
  private readonly logger = new Logger(OrderEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly settings: EmailSettingsService,
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

  private async trackingUrl(orderId: string) {
    const base = await this.settings.siteUrl();
    return base ? `${base}/client/orders/${orderId}` : '';
  }

  private values(order: LoadedOrder, extra: Record<string, string> = {}) {
    const items = order.items
      .map((item) => {
        const summary = (item.customization as { summary?: unknown } | null)?.summary;
        const line = `• ${item.quantity} × ${item.product.name}${typeof summary === 'string' && summary.trim() ? ` (${summary.trim()})` : ''}`;
        return `${line} — ${formatMoney(Number(item.unitPrice) * item.quantity, order.currency)}`;
      })
      .join('\n');
    return {
      customerName: order.shippingAddress?.fullName || order.user.name || 'there',
      orderId: order.id,
      orderItems: items,
      total: formatMoney(Number(order.totalAmount), order.currency),
      ...extra,
    } as Record<string, string>;
  }

  private customerAddress(order: LoadedOrder) {
    return order.shippingAddress?.email || order.user.email;
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

      const [templates, siteName, trackingUrl, emailSettings] = await Promise.all([
        loadEmailTemplates(this.prisma),
        this.siteName(),
        this.trackingUrl(order.id),
        this.settings.get(),
      ]);
      const template = templates.find((entry) => entry.key === 'order_confirmation');
      const values = this.values(order, { trackingUrl });

      if (template?.enabled) {
        const content = renderEmail({
          body: fillTemplate(template.body, values),
          button: trackingUrl ? { label: 'Track your order', url: trackingUrl } : null,
          footer: siteName ? `You are receiving this because you placed an order at ${siteName}.` : 'You are receiving this because you placed an order.',
          siteName,
        });
        await this.mail.send({ to: this.customerAddress(order), subject: fillTemplate(template.subject, values), ...content }, { kind: 'order-confirmation' });
      }

      if (emailSettings.notifyOnOrders) {
        const alertTo = await this.settings.alertAddress();
        if (alertTo) {
          const address = order.shippingAddress;
          const base = await this.settings.siteUrl();
          const body = [
            `A new order was placed: ${order.id}`,
            `Customer: ${values.customerName} (${this.customerAddress(order)})`,
            values.orderItems,
            `Total: ${values.total}`,
            address
              ? `Ship to:\n${[address.fullName, address.line1, address.line2, `${address.city}, ${address.state} ${address.postalCode}`, address.country].filter(Boolean).join('\n')}`
              : '',
          ]
            .filter(Boolean)
            .join('\n\n');
          const content = renderEmail({
            body,
            button: base ? { label: 'Open the order', url: `${base}/admin/orders/${order.id}` } : null,
            siteName,
          });
          await this.mail.send({ to: alertTo, subject: `New order ${order.id.slice(0, 12)} — ${values.total}`, ...content }, { kind: 'order-alert' });
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
      const templates = await loadEmailTemplates(this.prisma);
      const template = templates.find((entry) => entry.key === 'order_progress');
      if (!template?.enabled) return;
      const stageLabel = ORDER_STAGE_STEPS.find((step) => step.key === stage)?.label;
      if (!stageLabel) return;

      const [siteName, trackingUrl] = await Promise.all([this.siteName(), this.trackingUrl(order.id)]);
      const values = this.values(order, { stage: stageLabel.toLowerCase(), trackingUrl });
      const content = renderEmail({
        body: fillTemplate(template.body, values),
        button: trackingUrl ? { label: 'Track your order', url: trackingUrl } : null,
        footer: siteName ? `You are receiving this because you placed an order at ${siteName}.` : undefined,
        siteName,
      });
      await this.mail.send({ to: this.customerAddress(order), subject: fillTemplate(template.subject, values), ...content }, { kind: 'order-progress' });
    } catch (error) {
      this.logger.warn(`Progress email for ${orderId} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** The shipping notice, with the provider, tracking number and a link to the tracking page. */
  async sendShipped(options: { orderId: string; to?: string; trackingNumber?: string | null; carrier?: string | null }): Promise<void> {
    try {
      const order = await this.loadOrder(options.orderId);
      if (!order) return;
      const templates = await loadEmailTemplates(this.prisma);
      const template = templates.find((entry) => entry.key === 'order_shipped');
      if (!template?.enabled) return;

      const [siteName, trackingUrl] = await Promise.all([this.siteName(), this.trackingUrl(order.id)]);
      const values = this.values(order, {
        trackingNumber: options.trackingNumber ?? '',
        carrier: carrierLabel(options.carrier) || 'the carrier',
        trackingUrl,
      });
      const content = renderEmail({
        body: fillTemplate(template.body, values),
        button: trackingUrl ? { label: 'Track your order', url: trackingUrl } : null,
        footer: siteName ? `You are receiving this because you placed an order at ${siteName}.` : undefined,
        siteName,
      });
      await this.mail.send(
        { to: options.to || this.customerAddress(order), subject: fillTemplate(template.subject, values), ...content },
        { kind: 'order-shipped' },
      );
    } catch (error) {
      this.logger.warn(`Shipping email for ${options.orderId} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function formatMoney(amount: number, currency: string) {
  const value = Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
  return currency === 'USD' ? `$${value}` : `${value} ${currency}`;
}

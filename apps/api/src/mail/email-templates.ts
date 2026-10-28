import type { PrismaService } from '../prisma/prisma.service';

/** The editable order emails (Admin → Store settings → Emails). Placeholders look like {{customerName}}. */
export interface EmailTemplate {
  key: string;
  subject: string;
  body: string;
  enabled: boolean;
}

export const STORE_EMAILS_KEY = 'store_email_templates';

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    key: 'order_confirmation',
    subject: 'Your order has been received',
    body:
      'Hi {{customerName}}, thank you for your order! We have received order {{orderId}} and will start on it soon.\n\n' +
      '{{orderItems}}\n\nTotal: {{total}}',
    enabled: true,
  },
  {
    key: 'order_progress',
    subject: 'An update on your order',
    body: 'Hi {{customerName}}, your order {{orderId}} is now: {{stage}}.',
    enabled: true,
  },
  {
    key: 'order_shipped',
    subject: 'Your order has shipped',
    body:
      'Hi {{customerName}}, good news: your order {{orderId}} has shipped with {{carrier}}.\n\n' +
      'Tracking number: {{trackingNumber}}',
    enabled: true,
  },
  {
    key: 'cart_recovery',
    subject: 'You left something in your cart',
    body: 'Your cart is waiting for you. Complete your order here: {{cartUrl}}',
    enabled: false,
  },
];

/** The saved templates, with any template that did not exist when they were saved filled in from the defaults. */
export function mergeEmailTemplates(saved: unknown): EmailTemplate[] {
  const list = Array.isArray(saved) ? (saved as Array<Partial<EmailTemplate>>) : [];
  const byKey = new Map(list.filter((item) => item && typeof item.key === 'string').map((item) => [item.key as string, item]));
  const merged = DEFAULT_EMAIL_TEMPLATES.map((fallback) => {
    const item = byKey.get(fallback.key);
    return {
      key: fallback.key,
      subject: typeof item?.subject === 'string' && item.subject.trim() ? item.subject : fallback.subject,
      body: typeof item?.body === 'string' && item.body.trim() ? item.body : fallback.body,
      enabled: typeof item?.enabled === 'boolean' ? item.enabled : fallback.enabled,
    };
  });
  // Templates added some other way are kept as they are.
  for (const item of list) {
    if (item && typeof item.key === 'string' && !DEFAULT_EMAIL_TEMPLATES.some((entry) => entry.key === item.key)) {
      merged.push({ key: item.key, subject: String(item.subject ?? ''), body: String(item.body ?? ''), enabled: item.enabled !== false });
    }
  }
  return merged;
}

export async function loadEmailTemplates(prisma: PrismaService): Promise<EmailTemplate[]> {
  const row = await prisma.setting.findUnique({ where: { key: STORE_EMAILS_KEY } });
  if (!row?.value) return mergeEmailTemplates(null);
  try {
    return mergeEmailTemplates(JSON.parse(row.value));
  } catch {
    return mergeEmailTemplates(null);
  }
}

/** Fills {{placeholders}}; a placeholder with no value becomes empty, and unknown ones are left out. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, name: string) => values[name] ?? '');
}

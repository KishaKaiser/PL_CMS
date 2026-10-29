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
  // The emails to the shop owner. Whether they are sent is set on the Email page ("Email me when..."), not by `enabled`.
  {
    key: 'order_alert',
    subject: 'New order {{orderShort}} — {{total}}',
    body:
      'A new order was placed: {{orderId}}\n\nCustomer: {{customerName}} ({{customerEmail}})\n\n{{orderItems}}\n\n' +
      'Total: {{total}}\n\nShip to:\n{{shipTo}}',
    enabled: true,
  },
  {
    key: 'form_alert',
    subject: 'New form submission: {{formTitle}}',
    body: 'Someone submitted the form "{{formTitle}}":\n\n{{fields}}',
    enabled: true,
  },
  // The reminder for a cart left behind. It is switched on in Store settings → Cart Recovery, not by `enabled`.
  {
    key: 'cart_recovery',
    subject: 'You left something in your cart',
    body:
      'Hi {{customerName}}, you left a few things in your cart:\n\n{{orderItems}}\n\nTotal: {{total}}\n\n' +
      'They are waiting for you whenever you are ready.',
    enabled: false,
  },
  // Security emails: always sent, whatever `enabled` says.
  {
    key: 'password_reset',
    subject: 'Reset your password',
    body:
      'Hi {{customerName}}, we got a request to reset your password. Use the button below to choose a new one. ' +
      'The link works for {{expiresIn}}, and only once.\n\n' +
      'If you did not ask for this, you can ignore this email: your password will not change.',
    enabled: true,
  },
  {
    key: 'password_changed',
    subject: 'Your password was changed',
    body:
      'Hi {{customerName}}, the password on your account was just changed.\n\n' +
      'If this was you, there is nothing more to do. If it was not, reset your password straight away with the button below.',
    enabled: true,
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

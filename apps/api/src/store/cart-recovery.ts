/** What is kept about a cart left behind, and how it is shown in the reminder email. */

export interface RecoveryCartItem {
  name: string;
  /** For example the color or the choices of a custom candle. */
  detail: string;
  quantity: number;
  price: number;
}

const MAX_ITEMS = 50;

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/[\r\n]+/g, ' ').trim().slice(0, max) : '');

/**
 * Keeps only what the reminder needs from the cart the browser sent: a name, a short detail, a quantity and a price. Anything
 * else (and anything oddly shaped) is dropped, so what is stored and emailed cannot carry extra data.
 */
export function sanitizeCartItems(raw: unknown): RecoveryCartItem[] {
  if (!Array.isArray(raw)) return [];
  const items: RecoveryCartItem[] = [];
  for (const entry of raw.slice(0, MAX_ITEMS)) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    const name = text(item.productName, 120);
    const quantity = Math.round(Number(item.quantity));
    if (!name || !Number.isFinite(quantity) || quantity < 1) continue;
    const price = Number(item.variantPrice ?? item.productPrice);
    const custom = item.custom && typeof item.custom === 'object' ? (item.custom as Record<string, unknown>) : null;
    items.push({
      name,
      detail: text(custom?.details, 160) || text(item.variantColor, 80),
      quantity: Math.min(quantity, 99),
      price: Number.isFinite(price) && price >= 0 ? Math.round(price * 100) / 100 : 0,
    });
  }
  return items;
}

export function cartSubtotal(items: RecoveryCartItem[]): number {
  return Math.round(items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100;
}

/** The items as lines of text for the email: "• 2 × Cat Candle (Green) — $40.00". */
export function cartItemLines(items: RecoveryCartItem[], currency = 'USD'): string {
  const money = (amount: number) => (currency === 'USD' ? `$${amount.toFixed(2)}` : `${amount.toFixed(2)} ${currency}`);
  return items
    .map((item) => `• ${item.quantity} × ${item.name}${item.detail ? ` (${item.detail})` : ''} — ${money(item.price * item.quantity)}`)
    .join('\n');
}

/** Reads the stored items back (they were written by `sanitizeCartItems`, but the column is free-form). */
export function readStoredItems(value: unknown): RecoveryCartItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): RecoveryCartItem | null => {
      if (!entry || typeof entry !== 'object') return null;
      const item = entry as Record<string, unknown>;
      const name = text(item.name, 120);
      const quantity = Math.round(Number(item.quantity));
      const price = Number(item.price);
      if (!name || !Number.isFinite(quantity) || quantity < 1) return null;
      return { name, detail: text(item.detail, 160), quantity, price: Number.isFinite(price) && price >= 0 ? price : 0 };
    })
    .filter((item): item is RecoveryCartItem => item !== null);
}

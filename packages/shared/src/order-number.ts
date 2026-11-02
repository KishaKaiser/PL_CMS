/**
 * The order number customers see and type, such as PL-1042. The database numbers orders 1, 2, 3...; the number shown is
 * that plus 1000, so the first order is 1001 and numbers look like a shop's.
 */

export const ORDER_NUMBER_OFFSET = 1000;
export const DEFAULT_ORDER_PREFIX = 'PL';

/** The number as shown, for example PL-1042 (or just 1042 when the prefix is empty). */
export function formatOrderNumber(orderNumber: number, prefix: string = DEFAULT_ORDER_PREFIX): string {
  const shown = orderNumber + ORDER_NUMBER_OFFSET;
  const cleanPrefix = prefix.trim();
  return cleanPrefix ? `${cleanPrefix}-${shown}` : String(shown);
}

/** A prefix as saved on the store settings page: letters and digits only, at most ten. Empty falls back to the default. */
export function cleanOrderPrefix(value: unknown): string {
  const text = typeof value === 'string' ? value.replace(/[^A-Za-z0-9]/g, '').slice(0, 10) : '';
  return text || DEFAULT_ORDER_PREFIX;
}

export type OrderReference = { orderNumber: number } | { id: string };

/**
 * What someone typed to find an order: "PL-1042", "pl-1042", "#1042" or "1042" (the prefix does not matter), or an order's
 * long internal id from older links. Returns null for anything else.
 */
export function parseOrderReference(input: string): OrderReference | null {
  const value = String(input ?? '').trim().replace(/^#/, '').trim();
  const numbered = /^(?:[A-Za-z0-9]{1,10}\s*-\s*)?(\d{1,9})$/.exec(value);
  if (numbered) {
    const orderNumber = Number(numbered[1]) - ORDER_NUMBER_OFFSET;
    return orderNumber >= 1 ? { orderNumber } : null;
  }
  if (/^c[a-z0-9]{20,32}$/i.test(value)) return { id: value };
  return null;
}

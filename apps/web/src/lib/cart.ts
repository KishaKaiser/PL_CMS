/** What the customer chose for a custom candle (the server checks it again when the order is placed). */
export interface CartCustom {
  /** Tells two differently built candles apart in the cart. */
  key: string;
  typeId: string;
  colorId: string;
  color2Id?: string;
  sizeId?: string;
  herbIds: string[];
  /** The choices in words, for the cart and checkout (for example "Green · 6 inch · Herbs: Lavender"). */
  details: string;
  /** The candle's color(s), for the little color dots. */
  swatches: string[];
  weightOz?: number | null;
}

export interface CartItem {
  productId: string;
  productName: string;
  productPrice: number;
  productType?: 'PHYSICAL' | 'DIGITAL' | 'MINUTE_PACK';
  digitalDelivery?: 'NONE' | 'ASTROLOGY_REPORT';
  currency: string;
  variantId?: string;
  variantColor?: string;
  variantPrice?: number;
  quantity: number;
  custom?: CartCustom;
}

const CART_KEY = 'pl_cart';

/** One cart line: a product, its variant, and (for a custom candle) its choices. */
function lineKey(item: { productId: string; variantId?: string; custom?: { key: string } }) {
  return `${item.productId}:${item.variantId ?? ''}:${item.custom?.key ?? ''}`;
}

export function getCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function addToCart(item: CartItem): CartItem[] {
  const cart = getCart();
  const key = lineKey(item);
  const existing = cart.find((c) => lineKey(c) === key);
  if (existing) {
    existing.quantity += item.quantity;
  } else {
    cart.push(item);
  }
  saveCart(cart);
  return cart;
}

export function removeFromCart(productId: string, variantId?: string, customKey?: string): CartItem[] {
  const key = lineKey({ productId, variantId, custom: customKey ? { key: customKey } : undefined });
  const cart = getCart().filter((c) => lineKey(c) !== key);
  saveCart(cart);
  return cart;
}

export function updateCartQuantity(
  productId: string,
  variantId: string | undefined,
  quantity: number,
  customKey?: string,
): CartItem[] {
  const cart = getCart();
  const key = lineKey({ productId, variantId, custom: customKey ? { key: customKey } : undefined });
  const item = cart.find((c) => lineKey(c) === key);
  if (item) {
    if (quantity <= 0) {
      return removeFromCart(productId, variantId, customKey);
    }
    item.quantity = quantity;
    saveCart(cart);
  }
  return cart;
}

export function clearCart(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CART_KEY);
}

export function cartTotal(items: CartItem[]): number {
  return items.reduce(
    (sum, item) => sum + (item.variantPrice ?? item.productPrice) * item.quantity,
    0,
  );
}

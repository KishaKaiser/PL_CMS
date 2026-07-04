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
}

const CART_KEY = 'pl_cart';

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
  const key = `${item.productId}:${item.variantId ?? ''}`;
  const existing = cart.find(
    (c) => `${c.productId}:${c.variantId ?? ''}` === key,
  );
  if (existing) {
    existing.quantity += item.quantity;
  } else {
    cart.push(item);
  }
  saveCart(cart);
  return cart;
}

export function removeFromCart(productId: string, variantId?: string): CartItem[] {
  const key = `${productId}:${variantId ?? ''}`;
  const cart = getCart().filter(
    (c) => `${c.productId}:${c.variantId ?? ''}` !== key,
  );
  saveCart(cart);
  return cart;
}

export function updateCartQuantity(
  productId: string,
  variantId: string | undefined,
  quantity: number,
): CartItem[] {
  const cart = getCart();
  const key = `${productId}:${variantId ?? ''}`;
  const item = cart.find((c) => `${c.productId}:${c.variantId ?? ''}` === key);
  if (item) {
    if (quantity <= 0) {
      return removeFromCart(productId, variantId);
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

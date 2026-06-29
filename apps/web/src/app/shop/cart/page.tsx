'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CartItem,
  getCart,
  removeFromCart,
  updateCartQuantity,
  cartTotal,
} from '../../../lib/cart';

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    setCart(getCart());
  }, []);

  useEffect(() => {
    if (cart.length === 0) return;
    void fetch('/api/proxy/store/cart-recovery/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subtotal: cartTotal(cart),
        items: cart,
      }),
    }).catch(() => undefined);
  }, [cart]);

  const handleQuantityChange = (
    productId: string,
    variantId: string | undefined,
    qty: number,
  ) => {
    const updated = updateCartQuantity(productId, variantId, qty);
    setCart(updated);
  };

  const handleRemove = (productId: string, variantId?: string) => {
    const updated = removeFromCart(productId, variantId);
    setCart(updated);
  };

  const total = cartTotal(cart);

  if (cart.length === 0) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="mb-6 text-3xl font-bold">Your Cart</h1>
        <div className="rounded-lg border bg-white p-8 text-center text-gray-500">
          <p className="mb-4">Your cart is empty.</p>
          <Link href="/shop" className="text-purple-600 hover:underline">
            ← Browse Shop
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-3xl font-bold">Your Cart</h1>

      <div className="rounded-lg border bg-white shadow-sm">
        {cart.map((item) => {
          const linePrice = (item.variantPrice ?? item.productPrice) * item.quantity;
          return (
            <div
              key={`${item.productId}:${item.variantId ?? ''}`}
              className="flex items-center gap-4 border-b px-6 py-4 last:border-b-0"
            >
              <div className="flex-1">
                <p className="font-medium">{item.productName}</p>
                {item.variantColor && (
                  <p className="text-sm text-gray-500">
                    Color:{' '}
                    <span
                      className="inline-block h-4 w-4 rounded-full border align-middle"
                      style={{ backgroundColor: item.variantColor }}
                    />{' '}
                    {item.variantColor}
                  </p>
                )}
                <p className="text-sm text-gray-400">
                  ${(item.variantPrice ?? item.productPrice).toFixed(2)} each
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    handleQuantityChange(item.productId, item.variantId, Math.max(1, item.quantity - 1))
                  }
                  className="flex h-7 w-7 items-center justify-center rounded border text-lg font-bold hover:bg-gray-100"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm">{item.quantity}</span>
                <button
                  onClick={() =>
                    handleQuantityChange(item.productId, item.variantId, item.quantity + 1)
                  }
                  className="flex h-7 w-7 items-center justify-center rounded border text-lg font-bold hover:bg-gray-100"
                >
                  +
                </button>
              </div>

              <p className="w-20 text-right font-semibold">${linePrice.toFixed(2)}</p>

              <button
                onClick={() => handleRemove(item.productId, item.variantId)}
                className="ml-2 text-red-400 hover:text-red-600"
                title="Remove"
              >
                ✕
              </button>
            </div>
          );
        })}

        <div className="flex justify-between px-6 py-4 text-lg font-bold">
          <span>Subtotal</span>
          <span>${total.toFixed(2)} USD</span>
        </div>
      </div>

      <div className="mt-6 flex gap-4">
        <Link
          href="/shop"
          className="rounded border border-gray-300 px-6 py-3 text-sm text-gray-600 hover:bg-gray-50"
        >
          ← Continue Shopping
        </Link>
        <Link
          href="/shop/checkout"
          className="flex-1 rounded bg-purple-600 py-3 text-center text-sm text-white hover:bg-purple-700"
        >
          Proceed to Checkout →
        </Link>
      </div>
    </main>
  );
}

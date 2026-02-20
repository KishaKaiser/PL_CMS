'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Script from 'next/script';

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: {
        createOrder: () => Promise<string>;
        onApprove: (data: { orderID: string }) => Promise<void>;
        onError: (err: unknown) => void;
      }) => { render: (selector: string) => void };
    };
  }
}

interface Product {
  id: string;
  name: string;
  price: number;
  currency: string;
  minutesPack: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const productId = searchParams.get('productId');
  const successParam = searchParams.get('success');
  const cancelledParam = searchParams.get('cancelled');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [paypalClientId, setPaypalClientId] = useState('');
  const [paypalRendered, setPaypalRendered] = useState(false);

  // Load product if productId query param is present
  useEffect(() => {
    if (!productId) return;
    fetch(`/api/proxy/products/${productId}`)
      .then((r) => r.json())
      .then((p: Product) => setCart([{ product: p, quantity: 1 }]))
      .catch(() => setMessage('Failed to load product.'));
  }, [productId]);

  // Fetch PayPal client ID
  useEffect(() => {
    fetch('/api/proxy/payments/paypal-client-id')
      .then((r) => r.json())
      .then((data: { clientId?: string }) => {
        if (data.clientId) setPaypalClientId(data.clientId);
      })
      .catch(() => {
        // Silently fail; user will see "not configured" message
      });
  }, []);

  const total = cart.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0,
  );

  const renderPaypalButtons = useCallback(() => {
    if (!window.paypal || cart.length === 0 || paypalRendered) return;

    window.paypal
      .Buttons({
        createOrder: async () => {
          setStatus('loading');
          const res = await fetch('/api/proxy/checkout/paypal-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: cart.map((item) => ({
                productId: item.product.id,
                quantity: item.quantity,
              })),
            }),
          });
          if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as { message?: string };
            setStatus('error');
            setMessage(err.message ?? 'Failed to create order');
            throw new Error(err.message ?? 'Failed to create order');
          }
          const data = (await res.json()) as { paypalOrderId: string };
          return data.paypalOrderId;
        },
        onApprove: async (data) => {
          const res = await fetch(
            `/api/proxy/checkout/paypal-capture/${data.orderID}`,
            { method: 'POST' },
          );
          if (!res.ok) {
            setStatus('error');
            setMessage('Payment capture failed. Please contact support.');
            return;
          }
          setStatus('success');
          setMessage('🎉 Payment successful! Your order has been confirmed.');
          setCart([]);
        },
        onError: (err) => {
          setStatus('error');
          setMessage('PayPal encountered an error. Please try again.');
          console.error('PayPal error:', err);
        },
      })
      .render('#paypal-button-container');
    setPaypalRendered(true);
  }, [cart, paypalRendered]);

  useEffect(() => {
    if (paypalLoaded && cart.length > 0) {
      renderPaypalButtons();
    }
  }, [paypalLoaded, cart, renderPaypalButtons]);

  if (successParam) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-8 text-center">
        <h1 className="mb-3 text-2xl font-bold text-green-700">Payment Successful!</h1>
        <p className="text-gray-600">Your order has been confirmed. Enjoy your minutes!</p>
        <a href="/client" className="mt-6 inline-block text-indigo-600 hover:underline">
          Go to Client Portal →
        </a>
      </div>
    );
  }

  if (cancelledParam) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-8 text-center">
        <h1 className="mb-3 text-2xl font-bold text-yellow-700">Payment Cancelled</h1>
        <p className="text-gray-600">Your payment was cancelled. No charges were made.</p>
        <a href="/shop" className="mt-6 inline-block text-indigo-600 hover:underline">
          ← Back to Shop
        </a>
      </div>
    );
  }

  return (
    <>
      {paypalClientId && (
        <Script
          src={`https://www.paypal.com/sdk/js?client-id=${paypalClientId}&currency=USD`}
          onLoad={() => setPaypalLoaded(true)}
        />
      )}

      <h1 className="mb-6 text-3xl font-bold">Checkout</h1>

      {status === 'success' && (
        <div className="mb-6 rounded border border-green-200 bg-green-50 p-4 text-green-700">
          {message}
        </div>
      )}
      {status === 'error' && (
        <div className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-red-700">
          {message}
        </div>
      )}

      {cart.length === 0 && status !== 'success' ? (
        <div className="rounded-lg border bg-white p-6">
          <p className="text-gray-500">Your cart is empty.</p>
          <a href="/shop" className="mt-4 inline-block text-indigo-600 hover:underline">
            ← Browse Shop
          </a>
        </div>
      ) : (
        <>
          <div className="mb-6 rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Order Summary</h2>
            {cart.map((item) => (
              <div key={item.product.id} className="flex justify-between py-2 text-sm">
                <span>
                  {item.product.name}{' '}
                  <span className="text-gray-400">× {item.quantity}</span>
                </span>
                <span className="font-medium">
                  ${(Number(item.product.price) * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="mt-4 flex justify-between border-t pt-4 text-base font-bold">
              <span>Total</span>
              <span>${total.toFixed(2)} USD</span>
            </div>
          </div>

          {!paypalClientId ? (
            <div className="rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
              PayPal checkout is not configured. Please set{' '}
              <code>NEXT_PUBLIC_PAYPAL_CLIENT_ID</code> or{' '}
              <code>PAYPAL_CLIENT_ID</code> in your environment.
            </div>
          ) : (
            <div id="paypal-button-container" className="min-h-12" />
          )}
        </>
      )}

      <div className="mt-8">
        <a href="/shop" className="text-sm text-indigo-600 hover:underline">
          ← Back to Shop
        </a>
      </div>
    </>
  );
}

export default function CheckoutPage() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <Suspense fallback={<p className="text-gray-500">Loading checkout…</p>}>
        <CheckoutContent />
      </Suspense>
    </main>
  );
}

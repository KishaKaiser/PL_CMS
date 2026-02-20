'use client';

import { useState, useEffect } from 'react';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  minutesPack: number;
  currency: string;
}

export default function ClientShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/proxy/products')
      .then((r) => r.json())
      .then((data) => {
        setProducts(Array.isArray(data) ? data : []);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  async function handlePurchase(product: Product) {
    setPurchasing(product.id);
    setMessage('');
    try {
      const res = await fetch('/api/proxy/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ productId: product.id, quantity: 1 }] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(data?.message ?? 'Purchase failed');
      }
      const order = await res.json();
      setMessage(`✅ Order created (ID: ${order.id}). Awaiting payment confirmation.`);
    } catch (err: unknown) {
      setMessage(`❌ ${err instanceof Error ? err.message : 'Error'}`);
    } finally {
      setPurchasing(null);
    }
  }

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="mb-2 text-3xl font-bold">Buy Minute Packs</h1>
      <p className="mb-6 text-gray-600">
        Purchase minutes to use for advisor calls.
      </p>

      {message && (
        <div className="mb-6 rounded border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          {message}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading products…</p>
      ) : products.length === 0 ? (
        <p className="text-gray-500">No products available at the moment.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className="rounded-lg border bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">{p.name}</h2>
              {p.description && (
                <p className="mt-1 text-sm text-gray-500">{p.description}</p>
              )}
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-indigo-700">
                  ${Number(p.price).toFixed(2)}
                </span>
                <span className="text-sm text-gray-400">USD</span>
              </div>
              <p className="mt-1 text-sm font-medium text-green-700">
                {p.minutesPack} minutes
              </p>
              <button
                onClick={() => handlePurchase(p)}
                disabled={purchasing === p.id}
                className="mt-4 w-full rounded bg-indigo-600 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {purchasing === p.id ? 'Processing…' : 'Buy Now'}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 flex gap-4">
        <a href="/client" className="text-sm text-indigo-600 hover:underline">
          ← Back to Portal
        </a>
        <a href="/client/session" className="text-sm text-indigo-600 hover:underline">
          Active Session →
        </a>
      </div>
    </main>
  );
}

'use client';

import { useState } from 'react';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  minutesPack: number;
  isActive: boolean;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    minutesPack: '',
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/proxy/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          price: parseFloat(form.price),
          minutesPack: parseInt(form.minutesPack, 10),
          isActive: form.isActive,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(data?.message ?? 'Failed to create product');
      }
      const created = await res.json() as Product;
      setProducts((p) => [created, ...p]);
      setForm({ name: '', description: '', price: '', minutesPack: '', isActive: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/proxy/products/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError('Failed to delete product. Please try again.');
      return;
    }
    setProducts((p) => p.filter((x) => x.id !== id));
  }

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="mb-6 text-3xl font-bold">Products Management</h1>

      {/* Create form */}
      <section className="mb-8 rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold">Add New Product</h2>
        {error && <p className="mb-3 text-red-600">{error}</p>}
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700">Name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              placeholder="e.g. 30-Minute Pack"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Price (USD) *</label>
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Minutes Pack *</label>
            <input
              required
              type="number"
              min="0"
              value={form.minutesPack}
              onChange={(e) => setForm({ ...form, minutesPack: e.target.value })}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="h-4 w-4"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
              Active (visible in shop)
            </label>
          </div>
          <div className="col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-indigo-600 px-6 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Create Product'}
            </button>
          </div>
        </form>
      </section>

      {/* Product list */}
      <section>
        <h2 className="mb-3 text-xl font-semibold">All Products</h2>
        {products.length === 0 ? (
          <p className="text-gray-500">No products yet. Create one above.</p>
        ) : (
          <div className="overflow-auto rounded-lg border shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Name', 'Price (USD)', 'Minutes Pack', 'Active', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3">${Number(p.price).toFixed(2)}</td>
                    <td className="px-4 py-3">{p.minutesPack}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="rounded bg-red-100 px-3 py-1 text-xs text-red-700 hover:bg-red-200"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-6">
        <a href="/admin" className="text-sm text-indigo-600 hover:underline">
          ← Back to Admin
        </a>
      </div>
    </main>
  );
}

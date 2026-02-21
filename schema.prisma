'use client';

import { useState } from 'react';

interface Inventory {
  onHand: number;
  reserved: number;
}

interface ProductVariant {
  id: string;
  color: string;
  sku: string;
  priceOverride?: number | null;
  imageUrl?: string | null;
  isActive: boolean;
  inventory?: Inventory | null;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  minutesPack: number;
  isActive: boolean;
  variants: ProductVariant[];
}

const emptyVariantForm = {
  color: '',
  sku: '',
  priceOverride: '',
  imageUrl: '',
  onHand: '0',
};

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

  // Variant form state: keyed by productId
  const [variantForms, setVariantForms] = useState<Record<string, typeof emptyVariantForm>>({});
  const [variantErrors, setVariantErrors] = useState<Record<string, string>>({});
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

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
      setProducts((p) => [{ ...created, variants: [] }, ...p]);
      setForm({ name: '', description: '', price: '', minutesPack: '', isActive: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setError('');
    try {
      const res = await fetch(`/api/proxy/products/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? 'Failed to delete product');
      }
      setProducts((p) => p.filter((x) => x.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error deleting product');
    }
  }

  async function handleAddVariant(productId: string) {
    const vf = variantForms[productId] ?? emptyVariantForm;
    setVariantErrors((e) => ({ ...e, [productId]: '' }));
    try {
      const res = await fetch(`/api/proxy/products/${productId}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          color: vf.color,
          sku: vf.sku,
          priceOverride: vf.priceOverride ? parseFloat(vf.priceOverride) : undefined,
          imageUrl: vf.imageUrl || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(data?.message ?? 'Failed to add variant');
      }
      const variant = await res.json() as ProductVariant;
      // Update inventory if onHand > 0
      const onHand = parseInt(vf.onHand, 10);
      if (onHand > 0) {
        await fetch(`/api/proxy/products/${productId}/variants/${variant.id}/inventory`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ onHand }),
        });
        variant.inventory = { onHand, reserved: 0 };
      }
      setProducts((ps) =>
        ps.map((p) =>
          p.id === productId ? { ...p, variants: [...p.variants, variant] } : p,
        ),
      );
      setVariantForms((f) => ({ ...f, [productId]: emptyVariantForm }));
    } catch (err: unknown) {
      setVariantErrors((e) => ({
        ...e,
        [productId]: err instanceof Error ? err.message : 'Error',
      }));
    }
  }

  async function handleDeleteVariant(productId: string, variantId: string) {
    setVariantErrors((e) => ({ ...e, [productId]: '' }));
    try {
      const res = await fetch(`/api/proxy/products/${productId}/variants/${variantId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(data?.message ?? 'Failed to delete variant');
      }
      setProducts((ps) =>
        ps.map((p) =>
          p.id === productId
            ? { ...p, variants: p.variants.filter((v) => v.id !== variantId) }
            : p,
        ),
      );
    } catch (err: unknown) {
      setVariantErrors((e) => ({
        ...e,
        [productId]: err instanceof Error ? err.message : 'Error deleting variant',
      }));
    }
  }

  return (
    <main className="p-8 max-w-5xl mx-auto">
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
          <div className="space-y-4">
            {products.map((p) => (
              <div key={p.id} className="rounded-lg border bg-white shadow-sm">
                {/* Product row */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() =>
                        setExpandedProductId((id) => (id === p.id ? null : p.id))
                      }
                      className="text-indigo-600 hover:underline text-sm font-medium"
                    >
                      {expandedProductId === p.id ? '▲' : '▼'} {p.name}
                    </button>
                    <span className="text-sm text-gray-500">
                      ${Number(p.price).toFixed(2)} · {p.minutesPack} min
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {p.variants.length} variant{p.variants.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="rounded bg-red-100 px-3 py-1 text-xs text-red-700 hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>

                {/* Variants section */}
                {expandedProductId === p.id && (
                  <div className="border-t px-4 py-4 bg-gray-50">
                    <h3 className="mb-3 text-sm font-semibold text-gray-700">
                      Variants (Colors / SKUs)
                    </h3>

                    {variantErrors[p.id] && (
                      <p className="mb-2 text-xs text-red-600">{variantErrors[p.id]}</p>
                    )}

                    {/* Existing variants table */}
                    {p.variants.length > 0 && (
                      <div className="mb-4 overflow-auto rounded border bg-white">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-100">
                            <tr>
                              {['Color', 'SKU', 'Price Override', 'Image', 'In Stock', 'Reserved', 'Active', ''].map(
                                (h) => (
                                  <th
                                    key={h}
                                    className="px-3 py-2 text-left font-medium text-gray-600"
                                  >
                                    {h}
                                  </th>
                                ),
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {p.variants.map((v) => (
                              <tr key={v.id} className="border-t">
                                <td className="px-3 py-2 flex items-center gap-2">
                                  <span
                                    className="inline-block h-4 w-4 rounded-full border"
                                    style={{ backgroundColor: v.color }}
                                  />
                                  {v.color}
                                </td>
                                <td className="px-3 py-2 font-mono">{v.sku}</td>
                                <td className="px-3 py-2">
                                  {v.priceOverride != null
                                    ? `$${Number(v.priceOverride).toFixed(2)}`
                                    : '—'}
                                </td>
                                <td className="px-3 py-2">
                                  {v.imageUrl ? (
                                    <a
                                      href={v.imageUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-indigo-600 hover:underline"
                                    >
                                      View
                                    </a>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td className="px-3 py-2">{v.inventory?.onHand ?? 0}</td>
                                <td className="px-3 py-2">{v.inventory?.reserved ?? 0}</td>
                                <td className="px-3 py-2">
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                      v.isActive
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-gray-100 text-gray-500'
                                    }`}
                                  >
                                    {v.isActive ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <button
                                    onClick={() => handleDeleteVariant(p.id, v.id)}
                                    className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 hover:bg-red-200"
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Add variant form */}
                    <div className="grid grid-cols-3 gap-3 rounded border bg-white p-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600">
                          Color *
                        </label>
                        <input
                          value={variantForms[p.id]?.color ?? ''}
                          onChange={(e) =>
                            setVariantForms((f) => ({
                              ...f,
                              [p.id]: { ...(f[p.id] ?? emptyVariantForm), color: e.target.value },
                            }))
                          }
                          placeholder="e.g. #ff0000 or Red"
                          className="mt-1 w-full rounded border px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600">SKU *</label>
                        <input
                          value={variantForms[p.id]?.sku ?? ''}
                          onChange={(e) =>
                            setVariantForms((f) => ({
                              ...f,
                              [p.id]: { ...(f[p.id] ?? emptyVariantForm), sku: e.target.value },
                            }))
                          }
                          placeholder="e.g. PROD-RED-001"
                          className="mt-1 w-full rounded border px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600">
                          Price Override (USD)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={variantForms[p.id]?.priceOverride ?? ''}
                          onChange={(e) =>
                            setVariantForms((f) => ({
                              ...f,
                              [p.id]: {
                                ...(f[p.id] ?? emptyVariantForm),
                                priceOverride: e.target.value,
                              },
                            }))
                          }
                          placeholder="Leave blank to use product price"
                          className="mt-1 w-full rounded border px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600">
                          Image URL
                        </label>
                        <input
                          value={variantForms[p.id]?.imageUrl ?? ''}
                          onChange={(e) =>
                            setVariantForms((f) => ({
                              ...f,
                              [p.id]: {
                                ...(f[p.id] ?? emptyVariantForm),
                                imageUrl: e.target.value,
                              },
                            }))
                          }
                          placeholder="https://..."
                          className="mt-1 w-full rounded border px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600">
                          Initial Stock (On Hand)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={variantForms[p.id]?.onHand ?? '0'}
                          onChange={(e) =>
                            setVariantForms((f) => ({
                              ...f,
                              [p.id]: {
                                ...(f[p.id] ?? emptyVariantForm),
                                onHand: e.target.value,
                              },
                            }))
                          }
                          className="mt-1 w-full rounded border px-2 py-1 text-xs"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={() => handleAddVariant(p.id)}
                          className="rounded bg-indigo-600 px-4 py-1 text-xs text-white hover:bg-indigo-700"
                        >
                          Add Variant
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
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


'use client';

import type { ChangeEvent, InputHTMLAttributes } from 'react';
import { Fragment, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

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

interface Taxonomy {
  id: string;
  name: string;
  slug: string;
}

interface MediaAsset {
  id: string;
  title: string;
  originalName: string;
  url: string;
  isImage: boolean;
}

interface Product {
  id: string;
  name: string;
  description?: string | null;
  shortDescription?: string | null;
  price: number | string;
  regularPrice?: number | string | null;
  salePrice?: number | string | null;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  minutesPack: number;
  isActive: boolean;
  weightOz?: number | string | null;
  lengthIn?: number | string | null;
  widthIn?: number | string | null;
  heightIn?: number | string | null;
  trackStock: boolean;
  stockQuantity: number;
  stockStatus: string;
  imageUrl?: string | null;
  featuredMediaId?: string | null;
  featuredMedia?: MediaAsset | null;
  categories: Taxonomy[];
  tags: Taxonomy[];
  variants: ProductVariant[];
}

const emptyProductForm = {
  name: '',
  description: '',
  shortDescription: '',
  regularPrice: '',
  salePrice: '',
  saleStartsAt: '',
  saleEndsAt: '',
  minutesPack: '0',
  isActive: true,
  weightOz: '',
  lengthIn: '',
  widthIn: '',
  heightIn: '',
  trackStock: false,
  stockQuantity: '0',
  stockStatus: 'IN_STOCK',
  featuredMediaId: '',
  categoryIds: [] as string[],
  tagIds: [] as string[],
};

const emptyVariantForm = {
  color: '',
  sku: '',
  priceOverride: '',
  imageUrl: '',
  onHand: '0',
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Taxonomy[]>([]);
  const [tags, setTags] = useState<Taxonomy[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [form, setForm] = useState(emptyProductForm);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [variantForms, setVariantForms] = useState<Record<string, typeof emptyVariantForm>>({});
  const [variantErrors, setVariantErrors] = useState<Record<string, string>>({});
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    search: '',
    categoryId: '',
    stockStatus: '',
    status: '',
  });

  const imageMedia = useMemo(
    () => mediaAssets.filter((asset) => asset.isImage),
    [mediaAssets],
  );

  const selectedImage = useMemo(
    () => imageMedia.find((asset) => asset.id === form.featuredMediaId),
    [form.featuredMediaId, imageMedia],
  );

  const filteredProducts = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.categories.some((category) => category.name.toLowerCase().includes(query)) ||
        product.tags.some((tag) => tag.name.toLowerCase().includes(query));
      const matchesCategory = !filters.categoryId || product.categories.some((category) => category.id === filters.categoryId);
      const matchesStock = !filters.stockStatus || product.stockStatus === filters.stockStatus;
      const matchesStatus =
        !filters.status ||
        (filters.status === 'active' && product.isActive) ||
        (filters.status === 'inactive' && !product.isActive);
      return matchesSearch && matchesCategory && matchesStock && matchesStatus;
    });
  }, [filters, products]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [productsRes, categoriesRes, tagsRes, mediaRes] = await Promise.all([
        fetch('/api/proxy/products/all'),
        fetch('/api/proxy/admin/categories'),
        fetch('/api/proxy/admin/tags'),
        fetch('/api/proxy/media'),
      ]);

      if (!productsRes.ok) throw new Error('Failed to load products');
      if (!categoriesRes.ok) throw new Error('Failed to load categories');
      if (!tagsRes.ok) throw new Error('Failed to load tags');
      if (!mediaRes.ok) throw new Error('Failed to load media');

      setProducts((await productsRes.json()) as Product[]);
      setCategories((await categoriesRes.json()) as Taxonomy[]);
      setTags((await tagsRes.json()) as Taxonomy[]);
      setMediaAssets((await mediaRes.json()) as MediaAsset[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  function openCreateForm() {
    setForm(emptyProductForm);
    setEditingProductId(null);
    setShowEditor(true);
    setError('');
  }

  function openEditForm(product: Product) {
    setForm({
      name: product.name,
      description: product.description ?? '',
      shortDescription: product.shortDescription ?? '',
      regularPrice: String(product.regularPrice ?? product.price ?? ''),
      salePrice: product.salePrice == null ? '' : String(product.salePrice),
      saleStartsAt: toDatetimeLocal(product.saleStartsAt),
      saleEndsAt: toDatetimeLocal(product.saleEndsAt),
      minutesPack: String(product.minutesPack ?? 0),
      isActive: product.isActive,
      weightOz: product.weightOz == null ? '' : String(product.weightOz),
      lengthIn: product.lengthIn == null ? '' : String(product.lengthIn),
      widthIn: product.widthIn == null ? '' : String(product.widthIn),
      heightIn: product.heightIn == null ? '' : String(product.heightIn),
      trackStock: product.trackStock,
      stockQuantity: String(product.stockQuantity ?? 0),
      stockStatus: product.stockStatus ?? 'IN_STOCK',
      featuredMediaId: product.featuredMediaId ?? '',
      categoryIds: product.categories.map((category) => category.id),
      tagIds: product.tags.map((tag) => tag.id),
    });
    setEditingProductId(product.id);
    setShowEditor(true);
    setError('');
  }

  function closeEditor() {
    setForm(emptyProductForm);
    setEditingProductId(null);
    setShowEditor(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const body = buildProductPayload(form, Boolean(editingProductId));
      const res = await fetch(
        editingProductId
          ? `/api/proxy/products/${editingProductId}`
          : '/api/proxy/products',
        {
          method: editingProductId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data?.message ?? 'Failed to save product');
      }

      await fetchData();
      closeEditor();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error saving product');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setError('');
    try {
      const res = await fetch(`/api/proxy/products/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data?.message ?? 'Failed to delete product');
      }
      setProducts((current) => current.filter((product) => product.id !== id));
      if (editingProductId === id) closeEditor();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error deleting product');
    }
  }

  function exportProducts(format: 'json' | 'csv') {
    const rows = products.map((product) => ({
      name: product.name,
      description: product.description ?? '',
      shortDescription: product.shortDescription ?? '',
      regularPrice: product.regularPrice ?? product.price,
      salePrice: product.salePrice ?? '',
      saleStartsAt: product.saleStartsAt ?? '',
      saleEndsAt: product.saleEndsAt ?? '',
      minutesPack: product.minutesPack,
      isActive: product.isActive,
      weightOz: product.weightOz ?? '',
      lengthIn: product.lengthIn ?? '',
      widthIn: product.widthIn ?? '',
      heightIn: product.heightIn ?? '',
      trackStock: product.trackStock,
      stockQuantity: product.stockQuantity ?? 0,
      stockStatus: product.stockStatus,
      imageUrl: product.featuredMedia?.url ?? product.imageUrl ?? '',
      categories: product.categories.map((category) => category.name).join('|'),
      tags: product.tags.map((tag) => tag.name).join('|'),
    }));
    downloadRows(rows, `products-export.${format}`, format);
  }

  async function handleImportProducts(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImportStatus('Reading import file...');
    setError('');
    try {
      const items = await readImportFile(file);
      if (items.length === 0) throw new Error('No products were found in this file.');
      setImportStatus(`Found ${items.length} product${items.length === 1 ? '' : 's'}. Uploading import...`);
      const res = await fetch('/api/proxy/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? 'Product import failed');
      }
      const result = (await res.json()) as { created: number; skipped: number };
      setImportStatus(`Imported ${result.created} product${result.created === 1 ? '' : 's'}${result.skipped ? `, skipped ${result.skipped}` : ''}. Images are downloaded during import when possible.`);
      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Product import failed');
      setImportStatus('');
    }
  }

  async function handleAddVariant(productId: string) {
    const variantForm = variantForms[productId] ?? emptyVariantForm;
    setVariantErrors((current) => ({ ...current, [productId]: '' }));
    try {
      const res = await fetch(`/api/proxy/products/${productId}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          color: variantForm.color,
          sku: variantForm.sku,
          priceOverride: optionalNumber(variantForm.priceOverride),
          imageUrl: variantForm.imageUrl || undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data?.message ?? 'Failed to add variant');
      }
      const variant = (await res.json()) as ProductVariant;
      const onHand = parseInt(variantForm.onHand, 10);
      if (onHand > 0) {
        await fetch(`/api/proxy/products/${productId}/variants/${variant.id}/inventory`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ onHand }),
        });
        variant.inventory = { onHand, reserved: 0 };
      }
      setProducts((current) =>
        current.map((product) =>
          product.id === productId
            ? { ...product, variants: [...product.variants, variant] }
            : product,
        ),
      );
      setVariantForms((current) => ({ ...current, [productId]: emptyVariantForm }));
    } catch (err: unknown) {
      setVariantErrors((current) => ({
        ...current,
        [productId]: err instanceof Error ? err.message : 'Error adding variant',
      }));
    }
  }

  async function handleDeleteVariant(productId: string, variantId: string) {
    setVariantErrors((current) => ({ ...current, [productId]: '' }));
    try {
      const res = await fetch(`/api/proxy/products/${productId}/variants/${variantId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data?.message ?? 'Failed to delete variant');
      }
      setProducts((current) =>
        current.map((product) =>
          product.id === productId
            ? {
                ...product,
                variants: product.variants.filter((variant) => variant.id !== variantId),
              }
            : product,
        ),
      );
    } catch (err: unknown) {
      setVariantErrors((current) => ({
        ...current,
        [productId]: err instanceof Error ? err.message : 'Error deleting variant',
      }));
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="mt-1 text-sm text-gray-600">
            Review products first, then create or edit product details when needed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => exportProducts('csv')} className="rounded border border-gray-200 bg-white px-4 py-2 text-sm hover:bg-gray-50">Export CSV</button>
          <button type="button" onClick={() => exportProducts('json')} className="rounded border border-gray-200 bg-white px-4 py-2 text-sm hover:bg-gray-50">Export JSON</button>
          <label className="cursor-pointer rounded border border-gray-200 bg-white px-4 py-2 text-sm hover:bg-gray-50">
            Import
            <input type="file" accept=".csv,.json,.xml,application/json,text/csv,application/xml,text/xml" onChange={handleImportProducts} className="hidden" />
          </label>
          <button
            type="button"
            onClick={openCreateForm}
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Add New Product
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {importStatus && <p className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{importStatus}</p>}

      <section className="mb-6 rounded-lg border bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_160px_150px]">
          <label className="block text-sm font-medium text-gray-700">
            Search products
            <input
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              placeholder="Search by product, category, or tag"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Category
            <select value={filters.categoryId} onChange={(event) => setFilters((current) => ({ ...current, categoryId: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm">
              <option value="">All categories</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Stock
            <select value={filters.stockStatus} onChange={(event) => setFilters((current) => ({ ...current, stockStatus: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm">
              <option value="">All stock</option>
              <option value="IN_STOCK">In stock</option>
              <option value="OUT_OF_STOCK">Out of stock</option>
              <option value="BACKORDER">Backorder</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Status
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm">
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
      </section>

      {showEditor && (
        <section className="mb-8 rounded-lg border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">
              {editingProductId ? 'Edit Product' : 'Add New Product'}
            </h2>
            <button
              type="button"
              onClick={closeEditor}
              className="rounded border border-gray-200 px-3 py-1 text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <TextInput
              label="Name"
              value={form.name}
              onChange={(name) => setForm((current) => ({ ...current, name }))}
              required
              className="md:col-span-2"
            />
            <label className="block text-sm font-medium text-gray-700 md:col-span-2">
              Short Description (HTML allowed)
              <textarea
                value={form.shortDescription}
                onChange={(event) =>
                  setForm((current) => ({ ...current, shortDescription: event.target.value }))
                }
                rows={2}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                placeholder="Brief shop card summary"
              />
            </label>

            <label className="block text-sm font-medium text-gray-700 md:col-span-2">
              Description (HTML allowed)
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                rows={3}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </label>

            <TextInput
              label="Regular Price"
              type="number"
              step="0.01"
              min="0.01"
              value={form.regularPrice}
              onChange={(regularPrice) =>
                setForm((current) => ({ ...current, regularPrice }))
              }
              required
            />
            <TextInput
              label="Sale Price"
              type="number"
              step="0.01"
              min="0"
              value={form.salePrice}
              onChange={(salePrice) => setForm((current) => ({ ...current, salePrice }))}
            />
            <TextInput
              label="Sale Starts"
              type="datetime-local"
              value={form.saleStartsAt}
              onChange={(saleStartsAt) =>
                setForm((current) => ({ ...current, saleStartsAt }))
              }
            />
            <TextInput
              label="Sale Ends"
              type="datetime-local"
              value={form.saleEndsAt}
              onChange={(saleEndsAt) =>
                setForm((current) => ({ ...current, saleEndsAt }))
              }
            />

            <TextInput
              label="Minutes Pack"
              type="number"
              min="0"
              value={form.minutesPack}
              onChange={(minutesPack) =>
                setForm((current) => ({ ...current, minutesPack }))
              }
            />
            <TextInput
              label="Weight (oz)"
              type="number"
              step="0.01"
              min="0"
              value={form.weightOz}
              onChange={(weightOz) => setForm((current) => ({ ...current, weightOz }))}
            />
            <TextInput
              label="Length (in)"
              type="number"
              step="0.01"
              min="0"
              value={form.lengthIn}
              onChange={(lengthIn) => setForm((current) => ({ ...current, lengthIn }))}
            />
            <TextInput
              label="Width (in)"
              type="number"
              step="0.01"
              min="0"
              value={form.widthIn}
              onChange={(widthIn) => setForm((current) => ({ ...current, widthIn }))}
            />
            <TextInput
              label="Height (in)"
              type="number"
              step="0.01"
              min="0"
              value={form.heightIn}
              onChange={(heightIn) => setForm((current) => ({ ...current, heightIn }))}
            />
            <TextInput
              label="Current Stock Amount"
              type="number"
              min="0"
              value={form.stockQuantity}
              onChange={(stockQuantity) => setForm((current) => ({ ...current, stockQuantity }))}
            />

            <label className="block text-sm font-medium text-gray-700">
              Stock Status
              <select
                value={form.stockStatus}
                onChange={(event) =>
                  setForm((current) => ({ ...current, stockStatus: event.target.value }))
                }
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              >
                <option value="IN_STOCK">In stock</option>
                <option value="OUT_OF_STOCK">Out of stock</option>
                <option value="BACKORDER">Backorder</option>
              </select>
            </label>

            <label className="block text-sm font-medium text-gray-700 md:col-span-2">
              Product Image From Media
              <select
                value={form.featuredMediaId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, featuredMediaId: event.target.value }))
                }
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              >
                <option value="">No product image</option>
                {imageMedia.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.title || asset.originalName}
                  </option>
                ))}
              </select>
              {selectedImage && (
                <img
                  src={selectedImage.url}
                  alt={selectedImage.title}
                  className="mt-3 h-24 w-24 rounded border object-cover"
                />
              )}
            </label>

            <TaxonomyChooser
              label="Product Categories"
              items={categories}
              selectedIds={form.categoryIds}
              onChange={(categoryIds) => setForm((current) => ({ ...current, categoryIds }))}
            />
            <TaxonomyChooser
              label="Product Tags"
              items={tags}
              selectedIds={form.tagIds}
              onChange={(tagIds) => setForm((current) => ({ ...current, tagIds }))}
            />

            <div className="flex flex-wrap gap-5 md:col-span-2">
              <Checkbox
                label="Active (visible in shop)"
                checked={form.isActive}
                onChange={(isActive) => setForm((current) => ({ ...current, isActive }))}
              />
              <Checkbox
                label="Track stock"
                checked={form.trackStock}
                onChange={(trackStock) =>
                  setForm((current) => ({ ...current, trackStock }))
                }
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingProductId ? 'Save Product' : 'Create Product'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">All Products</h2>
          <span className="text-sm text-gray-500">{filteredProducts.length} of {products.length} total</span>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading products...</p>
        ) : products.length === 0 ? (
          <div className="rounded-lg border bg-white p-8 text-center">
            <p className="text-gray-500">No products yet.</p>
            <button
              type="button"
              onClick={openCreateForm}
              className="mt-4 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Add New Product
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Stock</th>
                  <th className="px-4 py-3 font-semibold">Price</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
            {filteredProducts.map((product) => {
              const imageUrl = product.featuredMedia?.url ?? product.imageUrl;
              return (
                <Fragment key={product.id}>
                <tr className="align-middle hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded border bg-gray-50">
                        {imageUrl ? (
                          <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-gray-400">
                            No image
                          </div>
                        )}
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedProductId((id) => (id === product.id ? null : product.id))
                          }
                          className="text-left text-lg font-semibold text-gray-900 hover:text-indigo-600"
                        >
                          {product.name}
                        </button>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                          <span>{product.variants.length} variant{product.variants.length === 1 ? '' : 's'}</span>
                          {!product.isActive && <span className="text-red-600">Inactive</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={stockBadgeClass(product.stockStatus)}>{product.stockStatus.replaceAll('_', ' ')}</span>
                    <p className="mt-1 text-xs text-gray-500">{product.trackStock ? `${product.stockQuantity ?? 0} available` : 'Not tracked'}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-semibold text-gray-900">${Number(product.regularPrice ?? product.price).toFixed(2)}</span>
                    {product.salePrice != null && <p className="text-xs text-red-600">Sale ${Number(product.salePrice).toFixed(2)}</p>}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {product.categories.length > 0 ? product.categories.map((category) => (
                        <span key={category.id} className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">{category.name}</span>
                      )) : <span className="text-xs text-gray-400">No category</span>}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="inline-flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditForm(product)}
                        className="rounded border border-gray-200 px-3 py-1 text-sm hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedProductId((id) => (id === product.id ? null : product.id))
                        }
                        className="rounded border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                      >
                        {expandedProductId === product.id ? 'Hide Variants' : 'Add Variants'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(product.id)}
                        className="rounded bg-red-100 px-3 py-1 text-sm text-red-700 hover:bg-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                  {expandedProductId === product.id && (
                    <tr>
                      <td colSpan={5} className="bg-gray-50 p-0">
                    <VariantPanel
                      product={product}
                      variantForm={variantForms[product.id] ?? emptyVariantForm}
                      mediaAssets={imageMedia}
                      error={variantErrors[product.id]}
                      onFormChange={(nextForm) =>
                        setVariantForms((current) => ({ ...current, [product.id]: nextForm }))
                      }
                      onAdd={() => handleAddVariant(product.id)}
                      onDelete={(variantId) => handleDeleteVariant(product.id, variantId)}
                    />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
              </tbody>
            </table>
            {filteredProducts.length === 0 && <p className="p-6 text-center text-sm text-gray-500">No products match these filters.</p>}
          </div>
        )}
      </section>
    </main>
  );
}

function stockBadgeClass(status: string) {
  if (status === 'OUT_OF_STOCK') return 'rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700';
  if (status === 'BACKORDER') return 'rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700';
  return 'rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700';
}

function buildProductPayload(form: typeof emptyProductForm, clearBlankValues: boolean) {
  const regularPrice = parseFloat(form.regularPrice);
  return {
    name: form.name,
    description: form.description || undefined,
    shortDescription: form.shortDescription || undefined,
    price: regularPrice,
    regularPrice,
    salePrice: optionalNumber(form.salePrice, clearBlankValues),
    saleStartsAt: optionalString(form.saleStartsAt, clearBlankValues),
    saleEndsAt: optionalString(form.saleEndsAt, clearBlankValues),
    minutesPack: parseInt(form.minutesPack || '0', 10),
    isActive: form.isActive,
    weightOz: optionalNumber(form.weightOz, clearBlankValues),
    lengthIn: optionalNumber(form.lengthIn, clearBlankValues),
    widthIn: optionalNumber(form.widthIn, clearBlankValues),
    heightIn: optionalNumber(form.heightIn, clearBlankValues),
    trackStock: form.trackStock,
    stockQuantity: Math.max(0, parseInt(form.stockQuantity || '0', 10)),
    stockStatus: form.stockStatus,
    featuredMediaId: optionalString(form.featuredMediaId, clearBlankValues),
    categoryIds: form.categoryIds,
    tagIds: form.tagIds,
  };
}

function optionalNumber(value: string, clearBlankValues = false) {
  return value === '' ? (clearBlankValues ? null : undefined) : Number(value);
}

function optionalString(value: string, clearBlankValues = false) {
  return value === '' ? (clearBlankValues ? null : undefined) : value;
}

async function readImportFile(file: File) {
  const text = await file.text();
  if (file.name.toLowerCase().endsWith('.xml')) return parseWxrProducts(text);
  if (file.name.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) return parsed as Array<Record<string, unknown>>;
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { items?: unknown }).items)) {
      return (parsed as { items: Array<Record<string, unknown>> }).items;
    }
    throw new Error('JSON import must be an array or an object with an items array.');
  }
  return parseCsv(text);
}

function parseWxrProducts(text: string) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const items = Array.from(doc.getElementsByTagName('item'));
  const attachments = buildWxrAttachmentMap(items);

  return items
    .filter((item) => wxrText(item, 'wp:post_type') === 'product')
    .map((item) => {
      const title = childText(item, 'title');
      const content = childText(item, 'content:encoded');
      const excerpt = childText(item, 'excerpt:encoded');
      const thumbnailId = wxrMeta(item, '_thumbnail_id');
      const image = attachments.get(thumbnailId) ?? firstImageFromHtml(content);
      return {
        name: title,
        Name: title,
        description: content,
        shortDescription: excerpt,
        regularPrice: wxrMeta(item, '_regular_price') || wxrMeta(item, '_price'),
        salePrice: wxrMeta(item, '_sale_price'),
        stockQuantity: wxrMeta(item, '_stock'),
        stockStatus: wxrMeta(item, '_stock_status'),
        trackStock: wxrMeta(item, '_manage_stock'),
        weightOz: wxrMeta(item, '_weight'),
        lengthIn: wxrMeta(item, '_length'),
        widthIn: wxrMeta(item, '_width'),
        heightIn: wxrMeta(item, '_height'),
        imageUrl: image ?? '',
        categories: wxrCategories(item, 'product_cat').join('|'),
        tags: wxrCategories(item, 'product_tag').join('|'),
      };
    });
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  const headers = rows.shift()?.map((header) => header.trim()) ?? [];
  return rows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ''])),
  );
}

function downloadRows(rows: Array<Record<string, unknown>>, filename: string, format: 'json' | 'csv') {
  const content = format === 'json' ? JSON.stringify(rows, null, 2) : toCsv(rows);
  const type = format === 'json' ? 'application/json' : 'text/csv';
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: Array<Record<string, unknown>>) {
  const headers = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));
  const lines = rows.map((row) => headers.map((header) => csvCell(row[header])).join(','));
  return [headers.join(','), ...lines].join('\n');
}

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function childText(parent: Element, tagName: string) {
  return findChildText(parent, tagName);
}

function findChildText(parent: Element, tagName: string) {
  const direct = parent.getElementsByTagName(tagName)[0]?.textContent?.trim();
  if (direct) return direct;
  const localName = tagName.split(':').pop();
  return Array.from(parent.children)
    .find((child) => child.localName === localName)
    ?.textContent?.trim() ?? '';
}

function wxrText(item: Element, tagName: string) {
  return childText(item, tagName);
}

function wxrMeta(item: Element, key: string) {
  const metas = Array.from(item.getElementsByTagName('wp:postmeta'));
  for (const meta of metas) {
    if (childText(meta, 'wp:meta_key') === key) return childText(meta, 'wp:meta_value');
  }
  return '';
}

function wxrCategories(item: Element, domain: string) {
  return Array.from(item.getElementsByTagName('category'))
    .filter((category) => category.getAttribute('domain') === domain)
    .map((category) => category.textContent?.trim() ?? '')
    .filter(Boolean);
}

function buildWxrAttachmentMap(items: Element[]) {
  const map = new Map<string, string>();
  for (const item of items) {
    if (wxrText(item, 'wp:post_type') !== 'attachment') continue;
    const id = wxrText(item, 'wp:post_id');
    const url = wxrText(item, 'wp:attachment_url');
    if (id && url) map.set(id, url);
  }
  return map;
}

function firstImageFromHtml(html: string) {
  return html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? null;
}

function toDatetimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
}

function TextInput({
  label,
  value,
  onChange,
  className = '',
  ...props
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'onChange' | 'value'>) {
  return (
    <label className={`block text-sm font-medium text-gray-700 ${className}`}>
      {label}
      <input
        {...props}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded border px-3 py-2 text-sm"
      />
    </label>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4"
      />
      {label}
    </label>
  );
}

function TaxonomyChooser({
  label,
  items,
  selectedIds,
  onChange,
}: {
  label: string;
  items: Taxonomy[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset className="rounded border p-3">
      <legend className="px-1 text-sm font-medium text-gray-700">{label}</legend>
      {items.length === 0 ? (
        <p className="text-xs text-gray-500">No options available.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <label key={item.id} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={selectedIds.includes(item.id)}
                onChange={(event) => {
                  if (event.target.checked) {
                    onChange([...selectedIds, item.id]);
                  } else {
                    onChange(selectedIds.filter((id) => id !== item.id));
                  }
                }}
              />
              {item.name}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function VariantPanel({
  product,
  variantForm,
  mediaAssets,
  error,
  onFormChange,
  onAdd,
  onDelete,
}: {
  product: Product;
  variantForm: typeof emptyVariantForm;
  mediaAssets: MediaAsset[];
  error?: string;
  onFormChange: (form: typeof emptyVariantForm) => void;
  onAdd: () => void;
  onDelete: (variantId: string) => void;
}) {
  return (
    <div className="border-t bg-gray-50 px-4 py-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">Product Variants</h3>
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      {product.variants.length > 0 && (
        <div className="mb-4 overflow-auto rounded border bg-white">
          <table className="w-full text-xs">
            <thead className="bg-gray-100">
              <tr>
                {['Color', 'SKU', 'Price Override', 'Image', 'In Stock', 'Reserved', 'Active', ''].map((heading) => (
                  <th key={heading} className="px-3 py-2 text-left font-medium text-gray-600">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {product.variants.map((variant) => (
                <tr key={variant.id} className="border-t">
                  <td className="px-3 py-2">{variant.color}</td>
                  <td className="px-3 py-2 font-mono">{variant.sku}</td>
                  <td className="px-3 py-2">
                    {variant.priceOverride != null
                      ? `$${Number(variant.priceOverride).toFixed(2)}`
                      : '-'}
                  </td>
                  <td className="px-3 py-2">
                    {variant.imageUrl ? (
                      <a href={variant.imageUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                        View
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-3 py-2">{variant.inventory?.onHand ?? 0}</td>
                  <td className="px-3 py-2">{variant.inventory?.reserved ?? 0}</td>
                  <td className="px-3 py-2">{variant.isActive ? 'Active' : 'Inactive'}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onDelete(variant.id)}
                      className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200"
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

      <div className="grid gap-3 rounded border bg-white p-3 md:grid-cols-3">
        <VariantInput
          label="Color"
          value={variantForm.color}
          onChange={(color) => onFormChange({ ...variantForm, color })}
        />
        <VariantInput
          label="SKU"
          value={variantForm.sku}
          onChange={(sku) => onFormChange({ ...variantForm, sku })}
        />
        <VariantInput
          label="Price Override"
          type="number"
          step="0.01"
          value={variantForm.priceOverride}
          onChange={(priceOverride) => onFormChange({ ...variantForm, priceOverride })}
        />
        <label className="block text-xs font-medium text-gray-600">
          Image from Media Library
          <select
            value={variantForm.imageUrl}
            onChange={(event) => onFormChange({ ...variantForm, imageUrl: event.target.value })}
            className="mt-1 w-full rounded border px-2 py-1 text-xs"
          >
            <option value="">Choose an image</option>
            {mediaAssets.map((asset) => (
              <option key={asset.id} value={asset.url}>
                {asset.title || asset.originalName}
              </option>
            ))}
          </select>
        </label>
        <VariantInput
          label="Image URL"
          value={variantForm.imageUrl}
          onChange={(imageUrl) => onFormChange({ ...variantForm, imageUrl })}
        />
        {variantForm.imageUrl && (
          <div className="flex items-end">
            <img src={variantForm.imageUrl} alt="Selected variant" className="h-16 w-16 rounded border bg-gray-50 object-cover" />
          </div>
        )}
        <VariantInput
          label="Initial Stock"
          type="number"
          value={variantForm.onHand}
          onChange={(onHand) => onFormChange({ ...variantForm, onHand })}
        />
        <div className="flex items-end">
          <button
            type="button"
            onClick={onAdd}
            className="rounded bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
          >
            Add Variant
          </button>
        </div>
      </div>
    </div>
  );
}

function VariantInput({
  label,
  value,
  onChange,
  type = 'text',
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  step?: string;
}) {
  return (
    <label className="block text-xs font-medium text-gray-600">
      {label}
      <input
        type={type}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded border px-2 py-1 text-xs"
      />
    </label>
  );
}

'use client';

import type { InputHTMLAttributes } from 'react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

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
  const [variantForms, setVariantForms] = useState<Record<string, typeof emptyVariantForm>>({});
  const [variantErrors, setVariantErrors] = useState<Record<string, string>>({});
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  const imageMedia = useMemo(
    () => mediaAssets.filter((asset) => asset.isImage),
    [mediaAssets],
  );

  const selectedImage = useMemo(
    () => imageMedia.find((asset) => asset.id === form.featuredMediaId),
    [form.featuredMediaId, imageMedia],
  );

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
        <button
          type="button"
          onClick={openCreateForm}
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Add New Product
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

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
              Description
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
          <span className="text-sm text-gray-500">{products.length} total</span>
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
          <div className="space-y-4">
            {products.map((product) => {
              const imageUrl = product.featuredMedia?.url ?? product.imageUrl;
              return (
                <div key={product.id} className="rounded-lg border bg-white shadow-sm">
                  <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex gap-4">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded border bg-gray-50">
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
                        <div className="mt-1 flex flex-wrap gap-2 text-sm text-gray-600">
                          <span>${Number(product.regularPrice ?? product.price).toFixed(2)}</span>
                          {product.salePrice != null && (
                            <span className="text-red-600">
                              Sale ${Number(product.salePrice).toFixed(2)}
                            </span>
                          )}
                          <span>{product.stockStatus.replaceAll('_', ' ')}</span>
                          <span>{product.variants.length} variant{product.variants.length === 1 ? '' : 's'}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {product.categories.map((category) => (
                            <span key={category.id} className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
                              {category.name}
                            </span>
                          ))}
                          {product.tags.map((tag) => (
                            <span key={tag.id} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEditForm(product)}
                        className="rounded border border-gray-200 px-3 py-1 text-sm hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(product.id)}
                        className="rounded bg-red-100 px-3 py-1 text-sm text-red-700 hover:bg-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {expandedProductId === product.id && (
                    <VariantPanel
                      product={product}
                      variantForm={variantForms[product.id] ?? emptyVariantForm}
                      error={variantErrors[product.id]}
                      onFormChange={(nextForm) =>
                        setVariantForms((current) => ({ ...current, [product.id]: nextForm }))
                      }
                      onAdd={() => handleAddVariant(product.id)}
                      onDelete={(variantId) => handleDeleteVariant(product.id, variantId)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function buildProductPayload(form: typeof emptyProductForm, clearBlankValues: boolean) {
  const regularPrice = parseFloat(form.regularPrice);
  return {
    name: form.name,
    description: form.description || undefined,
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
  error,
  onFormChange,
  onAdd,
  onDelete,
}: {
  product: Product;
  variantForm: typeof emptyVariantForm;
  error?: string;
  onFormChange: (form: typeof emptyVariantForm) => void;
  onAdd: () => void;
  onDelete: (variantId: string) => void;
}) {
  return (
    <div className="border-t bg-gray-50 px-4 py-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">Variants</h3>
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
        <VariantInput
          label="Image URL"
          value={variantForm.imageUrl}
          onChange={(imageUrl) => onFormChange({ ...variantForm, imageUrl })}
        />
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

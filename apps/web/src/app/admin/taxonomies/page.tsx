'use client';

import { useCallback, useEffect, useState } from 'react';
import { isValidSlug, slugify } from '../../../lib/cms';

interface TaxonomyItem {
  id: string;
  name: string;
  slug: string;
}

interface TaxonomyForm {
  name: string;
  slug: string;
}

const emptyForm: TaxonomyForm = { name: '', slug: '' };

async function readErrorMessage(res: Response, fallback: string) {
  const data = (await res.json().catch(() => ({}))) as { message?: string };
  return data.message ?? fallback;
}

export default function AdminTaxonomiesPage() {
  const [categories, setCategories] = useState<TaxonomyItem[]>([]);
  const [tags, setTags] = useState<TaxonomyItem[]>([]);
  const [categoryForm, setCategoryForm] = useState<TaxonomyForm>(emptyForm);
  const [tagForm, setTagForm] = useState<TaxonomyForm>(emptyForm);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [categoriesRes, tagsRes] = await Promise.all([
        fetch('/api/proxy/admin/categories'),
        fetch('/api/proxy/admin/tags'),
      ]);

      if (!categoriesRes.ok) throw new Error(await readErrorMessage(categoriesRes, 'Failed to load categories'));
      if (!tagsRes.ok) throw new Error(await readErrorMessage(tagsRes, 'Failed to load tags'));

      setCategories((await categoriesRes.json()) as TaxonomyItem[]);
      setTags((await tagsRes.json()) as TaxonomyItem[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createItem(kind: 'categories' | 'tags', form: TaxonomyForm) {
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }

    if (form.slug && !isValidSlug(form.slug)) {
      setError('Slug must contain lowercase letters, numbers, and hyphens only.');
      return;
    }

    setError('');
    const res = await fetch(`/api/proxy/admin/${kind}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: form.name.trim(), slug: form.slug || undefined }),
    });

    if (!res.ok) {
      setError(await readErrorMessage(res, `Failed to create ${kind === 'categories' ? 'category' : 'tag'}`));
      return;
    }

    await load();
    if (kind === 'categories') setCategoryForm(emptyForm);
    else setTagForm(emptyForm);
  }

  async function removeItem(kind: 'categories' | 'tags', id: string) {
    const itemLabel = kind === 'categories' ? 'category' : 'tag';
    if (!confirm(`Delete this ${itemLabel}?`)) return;

    setError('');
    const res = await fetch(`/api/proxy/admin/${kind}/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError(await readErrorMessage(res, `Failed to delete ${itemLabel}`));
      return;
    }

    await load();
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="text-3xl font-bold">Categories & Tags</h1>
      <p className="mt-2 text-sm text-gray-600">Manage post taxonomies used for public discovery and organization.</p>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Categories</h2>
          <div className="mt-4 grid gap-3">
            <input
              value={categoryForm.name}
              onChange={(event) =>
                setCategoryForm((current) => ({
                  ...current,
                  name: event.target.value,
                  slug: current.slug || slugify(event.target.value),
                }))
              }
              placeholder="Name"
              className="rounded border border-gray-200 px-3 py-2 text-sm"
            />
            <input
              value={categoryForm.slug}
              onChange={(event) => setCategoryForm((current) => ({ ...current, slug: slugify(event.target.value) }))}
              placeholder="slug"
              className="rounded border border-gray-200 px-3 py-2 font-mono text-sm"
            />
            <button
              onClick={() => void createItem('categories', categoryForm)}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Add category
            </button>
          </div>

          <ul className="mt-5 space-y-2 text-sm">
            {categories.map((item) => (
              <li key={item.id} className="flex items-center justify-between rounded border px-3 py-2">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="font-mono text-xs text-gray-500">{item.slug}</p>
                </div>
                <button
                  onClick={() => void removeItem('categories', item.id)}
                  className="rounded bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Tags</h2>
          <div className="mt-4 grid gap-3">
            <input
              value={tagForm.name}
              onChange={(event) =>
                setTagForm((current) => ({
                  ...current,
                  name: event.target.value,
                  slug: current.slug || slugify(event.target.value),
                }))
              }
              placeholder="Name"
              className="rounded border border-gray-200 px-3 py-2 text-sm"
            />
            <input
              value={tagForm.slug}
              onChange={(event) => setTagForm((current) => ({ ...current, slug: slugify(event.target.value) }))}
              placeholder="slug"
              className="rounded border border-gray-200 px-3 py-2 font-mono text-sm"
            />
            <button
              onClick={() => void createItem('tags', tagForm)}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Add tag
            </button>
          </div>

          <ul className="mt-5 space-y-2 text-sm">
            {tags.map((item) => (
              <li key={item.id} className="flex items-center justify-between rounded border px-3 py-2">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="font-mono text-xs text-gray-500">{item.slug}</p>
                </div>
                <button
                  onClick={() => void removeItem('tags', item.id)}
                  className="rounded bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

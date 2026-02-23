'use client';

import { useState, useEffect, useCallback } from 'react';

interface Page {
  id: string;
  slug: string;
  title: string;
  content: string;
  publishedAt: string | null;
  createdAt: string;
}

const emptyForm = { slug: '', title: '', content: '' };

export default function AdminPagesPage() {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/proxy/pages');
      if (!res.ok) throw new Error('Failed to load pages');
      setPages(await res.json() as Page[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchPages(); }, [fetchPages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const url = editingId ? `/api/proxy/pages/${editingId}` : '/api/proxy/pages';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(d.message ?? 'Save failed');
      }
      const saved = await res.json() as Page;
      if (editingId) {
        setPages((ps) => ps.map((p) => (p.id === editingId ? saved : p)));
      } else {
        setPages((ps) => [saved, ...ps]);
      }
      setForm(emptyForm);
      setEditingId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this page?')) return;
    try {
      const res = await fetch(`/api/proxy/pages/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('Delete failed');
      setPages((ps) => ps.filter((p) => p.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function handleTogglePublish(page: Page) {
    const action = page.publishedAt ? 'unpublish' : 'publish';
    try {
      const res = await fetch(`/api/proxy/pages/${page.id}/${action}`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Action failed');
      const updated = await res.json() as Page;
      setPages((ps) => ps.map((p) => (p.id === page.id ? updated : p)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  function startEdit(page: Page) {
    setEditingId(page.id);
    setForm({ slug: page.slug, title: page.title, content: page.content });
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="mb-6 text-3xl font-bold">Pages</h1>

      <section className="mb-8 rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">{editingId ? 'Edit Page' : 'Create Page'}</h2>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Slug *</label>
              <input required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="my-page-slug" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Title *</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Page Title" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Content *</label>
            <textarea required rows={6} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Page content (HTML or Markdown)…" />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="rounded bg-indigo-600 px-5 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : editingId ? 'Update Page' : 'Create Page'}
            </button>
            {editingId && (
              <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }}
                className="rounded border px-5 py-2 text-sm hover:bg-gray-50">
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">All Pages</h2>
        {loading ? <p className="text-gray-500">Loading…</p> : pages.length === 0 ? (
          <p className="text-gray-500">No pages yet.</p>
        ) : (
          <div className="overflow-auto rounded-lg border bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Slug', 'Title', 'Status', 'Created', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <tr key={page.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{page.slug}</td>
                    <td className="px-4 py-3 font-medium">{page.title}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${page.publishedAt ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {page.publishedAt ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(page.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(page)}
                          className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200">Edit</button>
                        <button onClick={() => handleTogglePublish(page)}
                          className={`rounded px-2 py-1 text-xs ${page.publishedAt ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                          {page.publishedAt ? 'Unpublish' : 'Publish'}
                        </button>
                        <button onClick={() => handleDelete(page.id)}
                          className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

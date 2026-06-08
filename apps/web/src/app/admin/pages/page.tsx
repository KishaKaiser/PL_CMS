'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { EditorPreview } from '../../../components/admin/editor-preview';
import { MediaLibrary, type MediaAsset, buildMediaEmbedHtml } from '../../../components/admin/media-library';
import { RichTextEditor } from '../../../components/admin/rich-text-editor';
import {
  type EditorialStatus,
  fromDatetimeLocalValue,
  getEditorialStatus,
  getEditorialStatusBadgeClass,
  getEditorialStatusLabel,
  isValidSlug,
  slugify,
  toDatetimeLocalValue,
} from '../../../lib/cms';

interface Page {
  id: string;
  slug: string;
  title: string;
  content: string;
  featuredImageUrl: string | null;
  featuredMedia: MediaAsset | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PageForm {
  slug: string;
  title: string;
  content: string;
  featuredImageUrl: string;
  featuredMediaId: string | null;
  editorialStatus: EditorialStatus;
  scheduledAt: string;
  currentPublishedAt: string | null;
}

// Minimum 1 minute lead time keeps minute-level scheduling from slipping into the past during save.
const SCHEDULE_MIN_LEAD_MS = 60_000;

const emptyForm: PageForm = {
  slug: '',
  title: '',
  content: '',
  featuredImageUrl: '',
  featuredMediaId: null,
  editorialStatus: 'draft',
  scheduledAt: '',
  currentPublishedAt: null,
};

function getPrimaryAction(status: EditorialStatus) {
  switch (status) {
    case 'published':
      return {
        action: 'unpublish',
        label: 'Move to draft',
        className: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200',
      };
    default:
      return {
        action: 'publish',
        label: 'Publish now',
        className: 'bg-green-100 text-green-700 hover:bg-green-200',
      };
  }
}

export default function AdminPagesPage() {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<PageForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [featuredMedia, setFeaturedMedia] = useState<MediaAsset | null>(null);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);

  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/proxy/pages');
      if (!res.ok) throw new Error('Failed to load pages');
      setPages((await res.json()) as Page[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPages();
  }, [fetchPages]);

  const slugError = useMemo(() => {
    if (!form.slug) return 'Slug is required.';
    if (!isValidSlug(form.slug)) return 'Use lowercase letters, numbers, and hyphens only.';
    return '';
  }, [form.slug]);

  const previewPublishedAt = useMemo(() => {
    if (form.editorialStatus === 'draft') return null;
    if (form.editorialStatus === 'scheduled') {
      return form.scheduledAt ? fromDatetimeLocalValue(form.scheduledAt) : null;
    }
    if (form.currentPublishedAt && getEditorialStatus(form.currentPublishedAt) === 'published') {
      return form.currentPublishedAt;
    }
    return new Date().toISOString();
  }, [form.currentPublishedAt, form.editorialStatus, form.scheduledAt]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (slugError) throw new Error(slugError);

      const now = new Date();
      let publishedAt: string | null = null;
      if (form.editorialStatus === 'scheduled') {
        if (!form.scheduledAt) throw new Error('Choose a future publish date and time.');
        publishedAt = fromDatetimeLocalValue(form.scheduledAt);
        if (new Date(publishedAt).getTime() < now.getTime() + SCHEDULE_MIN_LEAD_MS) {
          throw new Error('Scheduled publish time must be at least one minute in the future.');
        }
      } else if (form.editorialStatus === 'published') {
        publishedAt =
          form.currentPublishedAt && getEditorialStatus(form.currentPublishedAt) === 'published'
            ? form.currentPublishedAt
            : now.toISOString();
      }

      const payload = {
        slug: form.slug,
        title: form.title,
        content: form.content,
        featuredMediaId: form.featuredMediaId,
        featuredImageUrl: form.featuredMediaId ? null : form.featuredImageUrl || null,
        publishedAt,
      };

      const url = editingId ? `/api/proxy/pages/${editingId}` : '/api/proxy/pages';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(d.message ?? 'Save failed');
      }
      const saved = (await res.json()) as Page;
      if (editingId) {
        setPages((currentPages) => currentPages.map((page) => (page.id === editingId ? saved : page)));
      } else {
        setPages((currentPages) => [saved, ...currentPages]);
      }
      setForm(emptyForm);
      setFeaturedMedia(null);
      setEditingId(null);
      setShowMediaLibrary(false);
      setSlugTouched(false);
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
      setPages((currentPages) => currentPages.filter((page) => page.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function handlePrimaryAction(page: Page) {
    const status = getEditorialStatus(page.publishedAt);
    const { action } = getPrimaryAction(status);

    try {
      const res = await fetch(`/api/proxy/pages/${page.id}/${action}`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Action failed');
      const updated = (await res.json()) as Page;
      setPages((currentPages) => currentPages.map((entry) => (entry.id === page.id ? updated : entry)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  function startEdit(page: Page) {
    const editorialStatus = getEditorialStatus(page.publishedAt);
    setEditingId(page.id);
    setForm({
      slug: page.slug,
      title: page.title,
      content: page.content,
      featuredImageUrl: page.featuredImageUrl ?? '',
      featuredMediaId: page.featuredMedia?.id ?? null,
      editorialStatus,
      scheduledAt: editorialStatus === 'scheduled' ? toDatetimeLocalValue(page.publishedAt) : '',
      currentPublishedAt: page.publishedAt,
    });
    setFeaturedMedia(page.featuredMedia);
    setShowMediaLibrary(false);
    setSlugTouched(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setFeaturedMedia(null);
    setShowMediaLibrary(false);
    setSlugTouched(false);
    setError('');
  }

  function insertMediaIntoContent(asset: MediaAsset) {
    setForm((currentForm) => ({
      ...currentForm,
      content: `${currentForm.content}${currentForm.content ? '\n' : ''}${buildMediaEmbedHtml(asset)}`,
    }));
  }

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pages</h1>
          <p className="mt-1 text-sm text-gray-600">
            Create draft, scheduled, and published pages with richer editing tools.
          </p>
        </div>
        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="rounded border border-gray-200 bg-white px-4 py-2 text-sm hover:bg-gray-50"
          >
            Create New Page
          </button>
        )}
      </div>

      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{editingId ? 'Edit Page' : 'Create Page'}</h2>
            <p className="text-sm text-gray-500">Use the visual editor and publishing sidebar for a smoother workflow.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${getEditorialStatusBadgeClass(form.editorialStatus)}`}>
            {getEditorialStatusLabel(form.editorialStatus)}
          </span>
        </div>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Title *</label>
              <input
                required
                value={form.title}
                onChange={(event) => {
                  const title = event.target.value;
                  setForm((currentForm) => ({
                    ...currentForm,
                    title,
                    slug: slugTouched ? currentForm.slug : slugify(title),
                  }));
                }}
                className="mt-1 w-full rounded-lg border border-gray-200 px-4 py-3 text-sm"
                placeholder="About Psychic Link"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <label className="block text-sm font-medium text-gray-700">Slug *</label>
                <button
                  type="button"
                  onClick={() => {
                    setSlugTouched(true);
                    setForm((currentForm) => ({ ...currentForm, slug: slugify(currentForm.title || currentForm.slug) }));
                  }}
                  className="text-xs font-medium text-indigo-600 hover:underline"
                >
                  Regenerate from title
                </button>
              </div>
              <input
                required
                value={form.slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setForm((currentForm) => ({ ...currentForm, slug: slugify(event.target.value) }));
                }}
                className="mt-1 w-full rounded-lg border border-gray-200 px-4 py-3 font-mono text-sm"
                placeholder="about-psychic-link"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className={slugError ? 'text-red-600' : 'text-gray-500'}>
                  {slugError || 'Lowercase letters, numbers, and hyphens only.'}
                </span>
                <span className="text-gray-500">Permalink: /{form.slug || 'your-page'}</span>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Page Content *</label>
              <RichTextEditor value={form.content} onChange={(content) => setForm((currentForm) => ({ ...currentForm, content }))} />
            </div>
          </div>

          <div className="space-y-5">
            <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-900">Publishing</h3>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    value={form.editorialStatus}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        editorialStatus: event.target.value as EditorialStatus,
                        scheduledAt:
                          event.target.value === 'scheduled'
                            ? currentForm.scheduledAt || toDatetimeLocalValue(currentForm.currentPublishedAt)
                            : currentForm.scheduledAt,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Publish now</option>
                    <option value="scheduled">Schedule</option>
                  </select>
                </div>

                {form.editorialStatus === 'scheduled' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Publish on</label>
                    <input
                      type="datetime-local"
                      value={form.scheduledAt}
                      onChange={(event) => setForm((currentForm) => ({ ...currentForm, scheduledAt: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Featured Image</h3>
                  <p className="mt-1 text-xs text-gray-500">Choose a library asset for reuse or paste an external image URL.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMediaLibrary((currentValue) => !currentValue)}
                  className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  {showMediaLibrary ? 'Hide library' : 'Open library'}
                </button>
              </div>

              {featuredMedia && (
                <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                  Selected from media library: <span className="font-medium">{featuredMedia.title}</span>
                </div>
              )}

              <input
                type="url"
                value={form.featuredMediaId ? '' : form.featuredImageUrl}
                onChange={(event) => {
                  setFeaturedMedia(null);
                  setForm((currentForm) => ({
                    ...currentForm,
                    featuredMediaId: null,
                    featuredImageUrl: event.target.value,
                  }));
                }}
                className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="https://example.com/page-image.jpg"
              />

              <div className="mt-2 flex flex-wrap gap-2">
                {featuredMedia && (
                  <button
                    type="button"
                    onClick={() => {
                      setFeaturedMedia(null);
                      setForm((currentForm) => ({
                        ...currentForm,
                        featuredMediaId: null,
                        featuredImageUrl: '',
                      }));
                    }}
                    className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Clear media selection
                  </button>
                )}
              </div>

              {form.featuredImageUrl && (
                <img
                  src={form.featuredImageUrl}
                  alt="Featured preview"
                  className="mt-3 h-36 w-full rounded-lg border border-gray-200 object-cover"
                />
              )}

              {showMediaLibrary && (
                <div className="mt-4">
                  <MediaLibrary
                    title="Select page media"
                    description="Upload new assets, reuse existing images as the featured image, or insert media into the page body."
                    selectedMediaId={form.featuredMediaId}
                    onlyImages
                    onSelect={(asset) => {
                      setFeaturedMedia(asset);
                      setForm((currentForm) => ({
                        ...currentForm,
                        featuredMediaId: asset.id,
                        featuredImageUrl: asset.url,
                      }));
                    }}
                    onInsert={insertMediaIntoContent}
                  />
                </div>
              )}
            </section>

            <EditorPreview
              title={form.title}
              content={form.content}
              featuredImageUrl={form.featuredImageUrl}
              permalink={`/${form.slug || 'your-page'}`}
              status={form.editorialStatus}
              publishedAt={previewPublishedAt}
            />

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : editingId ? 'Update Page' : 'Create Page'}
              </button>
              {(editingId || form.title || form.slug || form.content || form.featuredImageUrl) && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium hover:bg-gray-50"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </form>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">All Pages</h2>
          <p className="text-sm text-gray-500">{pages.length} total</p>
        </div>
        {loading ? <p className="text-gray-500">Loading…</p> : pages.length === 0 ? (
          <p className="text-gray-500">No pages yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Title', 'Slug', 'Status', 'Updated', ''].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => {
                  const status = getEditorialStatus(page.publishedAt);
                  const primaryAction = getPrimaryAction(status);

                  return (
                    <tr key={page.id} className="border-t align-top hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          {page.featuredImageUrl && (
                            <img src={page.featuredImageUrl} alt={page.title} className="h-12 w-12 rounded object-cover" />
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{page.title}</p>
                            <p className="text-xs text-gray-500">Created {new Date(page.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">/{page.slug}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getEditorialStatusBadgeClass(status)}`}>
                          {getEditorialStatusLabel(status)}
                        </span>
                        {page.publishedAt && (
                          <p className="mt-2 text-xs text-gray-500">{new Date(page.publishedAt).toLocaleString()}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(page.updatedAt).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => startEdit(page)}
                            className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handlePrimaryAction(page)}
                            className={`rounded px-2 py-1 text-xs ${primaryAction.className}`}
                          >
                            {primaryAction.label}
                          </button>
                          <button
                            onClick={() => handleDelete(page.id)}
                            className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

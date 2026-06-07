'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { EditorPreview } from '../../../components/admin/editor-preview';
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

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  featuredImageUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; email: string };
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface PostForm {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  featuredImageUrl: string;
  authorId: string;
  editorialStatus: EditorialStatus;
  scheduledAt: string;
  currentPublishedAt: string | null;
}

const SCHEDULE_MIN_LEAD_MS = 60_000;

const emptyForm: PostForm = {
  slug: '',
  title: '',
  excerpt: '',
  content: '',
  featuredImageUrl: '',
  authorId: '',
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

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [authors, setAuthors] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<PostForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [postsRes, usersRes] = await Promise.all([
        fetch('/api/proxy/posts'),
        fetch('/api/proxy/users'),
      ]);
      if (!postsRes.ok) throw new Error('Failed to load posts');
      if (!usersRes.ok) throw new Error('Failed to load authors');

      const nextPosts = (await postsRes.json()) as Post[];
      const nextAuthors = (await usersRes.json()) as User[];
      setPosts(nextPosts);
      setAuthors(nextAuthors);
      setForm((currentForm) => ({
        ...currentForm,
        authorId: currentForm.authorId || nextAuthors[0]?.id || '',
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const selectedAuthor = useMemo(
    () => authors.find((author) => author.id === form.authorId) ?? null,
    [authors, form.authorId],
  );

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
      if (!form.authorId) throw new Error('Choose an author before saving this post.');

      let publishedAt: string | null = null;
      if (form.editorialStatus === 'scheduled') {
        if (!form.scheduledAt) throw new Error('Choose a future publish date and time.');
        publishedAt = fromDatetimeLocalValue(form.scheduledAt);
        if (new Date(publishedAt).getTime() < Date.now() + SCHEDULE_MIN_LEAD_MS) {
          throw new Error('Scheduled publish date must be at least one minute in the future.');
        }
      } else if (form.editorialStatus === 'published') {
        publishedAt =
          form.currentPublishedAt && getEditorialStatus(form.currentPublishedAt) === 'published'
            ? form.currentPublishedAt
            : new Date().toISOString();
      }

      const payload = {
        slug: form.slug,
        title: form.title,
        excerpt: form.excerpt || null,
        content: form.content,
        featuredImageUrl: form.featuredImageUrl || null,
        authorId: form.authorId,
        publishedAt,
      };

      const url = editingId ? `/api/proxy/posts/${editingId}` : '/api/proxy/posts';
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
      const saved = (await res.json()) as Post;
      if (editingId) {
        setPosts((currentPosts) => currentPosts.map((post) => (post.id === editingId ? saved : post)));
      } else {
        setPosts((currentPosts) => [saved, ...currentPosts]);
      }
      setForm({ ...emptyForm, authorId: authors[0]?.id ?? '' });
      setEditingId(null);
      setSlugTouched(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this post?')) return;
    try {
      const res = await fetch(`/api/proxy/posts/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('Delete failed');
      setPosts((currentPosts) => currentPosts.filter((post) => post.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function handlePrimaryAction(post: Post) {
    const status = getEditorialStatus(post.publishedAt);
    const { action } = getPrimaryAction(status);

    try {
      const res = await fetch(`/api/proxy/posts/${post.id}/${action}`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Action failed');
      const updated = (await res.json()) as Post;
      setPosts((currentPosts) => currentPosts.map((entry) => (entry.id === post.id ? updated : entry)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  function startEdit(post: Post) {
    const editorialStatus = getEditorialStatus(post.publishedAt);
    setEditingId(post.id);
    setForm({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt ?? '',
      content: post.content,
      featuredImageUrl: post.featuredImageUrl ?? '',
      authorId: post.author.id,
      editorialStatus,
      scheduledAt: editorialStatus === 'scheduled' ? toDatetimeLocalValue(post.publishedAt) : '',
      currentPublishedAt: post.publishedAt,
    });
    setSlugTouched(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm, authorId: authors[0]?.id ?? '' });
    setSlugTouched(false);
    setError('');
  }

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Posts</h1>
          <p className="mt-1 text-sm text-gray-600">
            Draft, schedule, preview, and publish posts with richer authoring tools.
          </p>
        </div>
        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="rounded border border-gray-200 bg-white px-4 py-2 text-sm hover:bg-gray-50"
          >
            Create New Post
          </button>
        )}
      </div>

      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{editingId ? 'Edit Post' : 'Create Post'}</h2>
            <p className="text-sm text-gray-500">Choose an author, refine the slug, and preview the post before publishing.</p>
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
                placeholder="June astrology forecast"
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
                placeholder="june-astrology-forecast"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className={slugError ? 'text-red-600' : 'text-gray-500'}>
                  {slugError || 'Lowercase letters, numbers, and hyphens only.'}
                </span>
                <span className="text-gray-500">Permalink: /blog/{form.slug || 'your-post'}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Excerpt</label>
              <textarea
                value={form.excerpt}
                onChange={(event) => setForm((currentForm) => ({ ...currentForm, excerpt: event.target.value }))}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-200 px-4 py-3 text-sm"
                placeholder="Add a short summary for cards and blog listings."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Post Content *</label>
              <RichTextEditor value={form.content} onChange={(content) => setForm((currentForm) => ({ ...currentForm, content }))} />
            </div>
          </div>

          <div className="space-y-5">
            <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-900">Publishing</h3>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Author</label>
                  <select
                    value={form.authorId}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, authorId: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    {authors.map((author) => (
                      <option key={author.id} value={author.id}>
                        {author.name} ({author.email})
                      </option>
                    ))}
                  </select>
                </div>

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
              <h3 className="text-sm font-semibold text-gray-900">Featured Image</h3>
              <input
                type="url"
                value={form.featuredImageUrl}
                onChange={(event) => setForm((currentForm) => ({ ...currentForm, featuredImageUrl: event.target.value }))}
                className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="https://example.com/post-image.jpg"
              />
              <p className="mt-2 text-xs text-gray-500">Paste an image URL to highlight the post in cards and detail pages.</p>
              {form.featuredImageUrl && (
                <img
                  src={form.featuredImageUrl}
                  alt="Featured preview"
                  className="mt-3 h-36 w-full rounded-lg border border-gray-200 object-cover"
                />
              )}
            </section>

            <EditorPreview
              title={form.title}
              excerpt={form.excerpt}
              content={form.content}
              featuredImageUrl={form.featuredImageUrl}
              permalink={`/blog/${form.slug || 'your-post'}`}
              status={form.editorialStatus}
              publishedAt={previewPublishedAt}
              authorName={selectedAuthor?.name}
            />

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving || authors.length === 0}
                className="rounded bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : editingId ? 'Update Post' : 'Create Post'}
              </button>
              {(editingId || form.title || form.slug || form.excerpt || form.content || form.featuredImageUrl) && (
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
          <h2 className="text-lg font-semibold">All Posts</h2>
          <p className="text-sm text-gray-500">{posts.length} total</p>
        </div>
        {loading ? <p className="text-gray-500">Loading…</p> : posts.length === 0 ? (
          <p className="text-gray-500">No posts yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Title', 'Author', 'Status', 'Updated', ''].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => {
                  const status = getEditorialStatus(post.publishedAt);
                  const primaryAction = getPrimaryAction(status);

                  return (
                    <tr key={post.id} className="border-t align-top hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          {post.featuredImageUrl && (
                            <img src={post.featuredImageUrl} alt={post.title} className="h-12 w-12 rounded object-cover" />
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{post.title}</p>
                            <p className="text-xs text-gray-500">/blog/{post.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        <p className="font-medium text-gray-800">{post.author.name}</p>
                        <p>{post.author.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getEditorialStatusBadgeClass(status)}`}>
                          {getEditorialStatusLabel(status)}
                        </span>
                        {post.publishedAt && (
                          <p className="mt-2 text-xs text-gray-500">{new Date(post.publishedAt).toLocaleString()}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(post.updatedAt).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => startEdit(post)}
                            className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handlePrimaryAction(post)}
                            className={`rounded px-2 py-1 text-xs ${primaryAction.className}`}
                          >
                            {primaryAction.label}
                          </button>
                          <button
                            onClick={() => handleDelete(post.id)}
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

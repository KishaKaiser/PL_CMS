'use client';

import { useState, useEffect, useCallback } from 'react';

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  publishedAt: string | null;
  createdAt: string;
  author: { id: string; name: string; email: string };
}

const emptyForm = { slug: '', title: '', excerpt: '', content: '', authorId: '' };

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/proxy/posts');
      if (!res.ok) throw new Error('Failed to load posts');
      setPosts(await res.json() as Post[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchPosts(); }, [fetchPosts]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const url = editingId ? `/api/proxy/posts/${editingId}` : '/api/proxy/posts';
      const method = editingId ? 'PUT' : 'POST';
      const payload = editingId
        ? { slug: form.slug, title: form.title, excerpt: form.excerpt || undefined, content: form.content }
        : { ...form, excerpt: form.excerpt || undefined };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(d.message ?? 'Save failed');
      }
      const saved = await res.json() as Post;
      if (editingId) {
        setPosts((ps) => ps.map((p) => (p.id === editingId ? saved : p)));
      } else {
        setPosts((ps) => [saved, ...ps]);
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
    if (!confirm('Delete this post?')) return;
    try {
      const res = await fetch(`/api/proxy/posts/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('Delete failed');
      setPosts((ps) => ps.filter((p) => p.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function handleTogglePublish(post: Post) {
    const action = post.publishedAt ? 'unpublish' : 'publish';
    try {
      const res = await fetch(`/api/proxy/posts/${post.id}/${action}`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Action failed');
      const updated = await res.json() as Post;
      setPosts((ps) => ps.map((p) => (p.id === post.id ? updated : p)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  function startEdit(post: Post) {
    setEditingId(post.id);
    setForm({ slug: post.slug, title: post.title, excerpt: post.excerpt ?? '', content: post.content, authorId: post.author.id });
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="mb-6 text-3xl font-bold">Posts</h1>

      <section className="mb-8 rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">{editingId ? 'Edit Post' : 'Create Post'}</h2>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Slug *</label>
              <input required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="my-post-slug" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Title *</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Post Title" />
            </div>
          </div>
          {!editingId && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Author ID *</label>
              <input required value={form.authorId} onChange={(e) => setForm({ ...form, authorId: e.target.value })}
                className="mt-1 w-full rounded border px-3 py-2 text-sm font-mono" placeholder="User ID" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Excerpt</label>
            <input value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Short summary…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Content *</label>
            <textarea required rows={6} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Post content…" />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="rounded bg-indigo-600 px-5 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : editingId ? 'Update Post' : 'Create Post'}
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
        <h2 className="mb-3 text-lg font-semibold">All Posts</h2>
        {loading ? <p className="text-gray-500">Loading…</p> : posts.length === 0 ? (
          <p className="text-gray-500">No posts yet.</p>
        ) : (
          <div className="overflow-auto rounded-lg border bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Slug', 'Title', 'Author', 'Status', 'Created', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{post.slug}</td>
                    <td className="px-4 py-3 font-medium">{post.title}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{post.author.name}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${post.publishedAt ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {post.publishedAt ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(post.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(post)}
                          className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200">Edit</button>
                        <button onClick={() => handleTogglePublish(post)}
                          className={`rounded px-2 py-1 text-xs ${post.publishedAt ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                          {post.publishedAt ? 'Unpublish' : 'Publish'}
                        </button>
                        <button onClick={() => handleDelete(post.id)}
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

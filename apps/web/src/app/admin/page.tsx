'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  getEditorialStatus,
  getEditorialStatusBadgeClass,
  getEditorialStatusLabel,
} from '../../lib/cms';

interface DashboardStats {
  posts: { total: number; published: number; draft: number; scheduled: number };
  pages: { total: number; published: number; draft: number };
  recentPosts: Array<{
    id: string;
    title: string;
    slug: string;
    publishedAt: string | null;
    updatedAt: string;
    author: { name: string | null; username?: string | null };
  }>;
  recentPages: Array<{
    id: string;
    title: string;
    slug: string;
    publishedAt: string | null;
    updatedAt: string;
  }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    createdAt: string;
    actor: { name: string | null; email: string };
  }>;
}

const QUICK_ACTIONS = [
  { href: '/admin/posts', label: 'Manage posts' },
  { href: '/admin/pages', label: 'Manage pages' },
  { href: '/admin/media', label: 'Open media library' },
  { href: '/admin/audit', label: 'Review audit log' },
];

export default function AdminPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/proxy/dashboard');
      if (!res.ok) throw new Error('Failed to load dashboard');
      setStats((await res.json()) as DashboardStats);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  return (
    <main className="mx-auto max-w-7xl p-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">
            Monitor publishing activity, review recent updates, and jump straight into editorial
            workflows.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      {error && <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      {loading || !stats ? (
        <p className="text-gray-500">Loading dashboard…</p>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: 'Total posts',
                value: stats.posts.total,
                note: `${stats.posts.published} published`,
              },
              {
                label: 'Draft posts',
                value: stats.posts.draft,
                note: `${stats.posts.scheduled} scheduled`,
              },
              {
                label: 'Published posts',
                value: stats.posts.published,
                note: `${stats.posts.total} total posts`,
              },
              {
                label: 'Scheduled posts',
                value: stats.posts.scheduled,
                note: `${stats.posts.draft} drafts remaining`,
              },
              {
                label: 'Total pages',
                value: stats.pages.total,
                note: `${stats.pages.published} published`,
              },
              {
                label: 'Draft pages',
                value: stats.pages.draft,
                note: `${stats.pages.total} total pages`,
              },
              {
                label: 'Published pages',
                value: stats.pages.published,
                note: `${stats.pages.draft} drafts remaining`,
              },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <p className="text-sm font-medium text-gray-500">{card.label}</p>
                <p className="mt-3 text-3xl font-semibold text-gray-900">{card.value}</p>
                <p className="mt-2 text-xs text-gray-500">{card.note}</p>
              </div>
            ))}
          </section>

          <section className="mt-8 grid gap-6 xl:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Recent posts</h2>
                <Link
                  href="/admin/posts"
                  className="text-sm font-medium text-indigo-600 hover:underline"
                >
                  View all
                </Link>
              </div>
              {stats.recentPosts.length === 0 ? (
                <p className="text-sm text-gray-500">No recent post updates.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Title', 'Author', 'Status', 'Updated'].map((heading) => (
                          <th
                            key={heading}
                            className="px-4 py-3 text-left text-xs font-semibold text-gray-600"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentPosts.map((post) => {
                        const status = getEditorialStatus(post.publishedAt);
                        return (
                          <tr key={post.id} className="border-t">
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{post.title}</p>
                              <p className="text-xs text-gray-500">/blog/{post.slug}</p>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {post.author.username || post.author.name || 'Unknown author'}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${getEditorialStatusBadgeClass(status)}`}
                              >
                                {getEditorialStatusLabel(status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {new Date(post.updatedAt).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Recent pages</h2>
                <Link
                  href="/admin/pages"
                  className="text-sm font-medium text-indigo-600 hover:underline"
                >
                  View all
                </Link>
              </div>
              {stats.recentPages.length === 0 ? (
                <p className="text-sm text-gray-500">No recent page updates.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Title', 'Slug', 'Status', 'Updated'].map((heading) => (
                          <th
                            key={heading}
                            className="px-4 py-3 text-left text-xs font-semibold text-gray-600"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentPages.map((page) => {
                        const status = getEditorialStatus(page.publishedAt);
                        return (
                          <tr key={page.id} className="border-t">
                            <td className="px-4 py-3 font-medium text-gray-900">{page.title}</td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-500">
                              /{page.slug}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${getEditorialStatusBadgeClass(status)}`}
                              >
                                {getEditorialStatusLabel(status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {new Date(page.updatedAt).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Recent audit activity</h2>
              <Link
                href="/admin/audit"
                className="text-sm font-medium text-indigo-600 hover:underline"
              >
                Open audit log
              </Link>
            </div>
            {stats.recentAuditLogs.length === 0 ? (
              <p className="text-sm text-gray-500">No audit entries found.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Actor', 'Action', 'Entity', 'When'].map((heading) => (
                        <th
                          key={heading}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-600"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentAuditLogs.map((log) => (
                      <tr key={log.id} className="border-t">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">
                            {log.actor.name || log.actor.email}
                          </p>
                          <p className="text-xs text-gray-500">{log.actor.email}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700">{log.action}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {log.entity}
                          {log.entityId ? ` · ${log.entityId}` : ''}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

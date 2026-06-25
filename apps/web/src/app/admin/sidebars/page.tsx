'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_SITE_SIDEBARS, type SiteSidebarWidget, type SiteSidebarWidgetType, type SiteSidebarsSettings } from '@pl-cms/shared';

const SITE_SIDEBARS_KEY = 'site_sidebars';

const WIDGET_TYPES: Array<{ type: SiteSidebarWidgetType; label: string }> = [
  { type: 'search', label: 'Search' },
  { type: 'categories', label: 'Blog Categories' },
  { type: 'tags', label: 'Blog Tags' },
  { type: 'authors', label: 'Authors' },
  { type: 'archives', label: 'Archives' },
  { type: 'image', label: 'Image' },
  { type: 'form', label: 'Saved Form' },
  { type: 'menu', label: 'Saved Menu' },
  { type: 'shop_categories', label: 'Shop Categories' },
  { type: 'price_filter', label: 'Price Filter' },
  { type: 'color_filter', label: 'Color Filter' },
];

export default function AdminSidebarsPage() {
  const [sidebars, setSidebars] = useState<SiteSidebarsSettings>(DEFAULT_SITE_SIDEBARS);
  const [activeSidebar, setActiveSidebar] = useState<'blog' | 'shop'>('blog');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const widgets = sidebars[activeSidebar];
  const widgetTypeMap = useMemo(() => new Map(WIDGET_TYPES.map((item) => [item.type, item.label])), []);

  const fetchSidebars = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/proxy/settings/${SITE_SIDEBARS_KEY}`);
      if (!res.ok && res.status !== 404) throw new Error('Could not load sidebars');
      const setting = res.ok ? ((await res.json()) as { value?: string } | null) : null;
      setSidebars(normalizeSidebars(setting?.value));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load sidebars');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSidebars();
  }, [fetchSidebars]);

  function updateWidgets(nextWidgets: SiteSidebarWidget[]) {
    setSidebars((current) => ({ ...current, [activeSidebar]: nextWidgets }));
  }

  function updateWidget(index: number, patch: Partial<SiteSidebarWidget>) {
    updateWidgets(widgets.map((widget, widgetIndex) => (widgetIndex === index ? { ...widget, ...patch } : widget)));
  }

  function addWidget(type: SiteSidebarWidgetType) {
    updateWidgets([
      ...widgets,
      {
        id: `${activeSidebar}-${type}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        enabled: true,
        title: widgetTypeMap.get(type) ?? 'Widget',
        settings: {},
      },
    ]);
  }

  async function saveSidebars() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/proxy/settings/${SITE_SIDEBARS_KEY}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(sidebars) }),
      });
      if (!res.ok) throw new Error('Could not save sidebars');
      setMessage('Sidebars saved.');
      await fetchSidebars();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save sidebars');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Sidebars</h1>
          <p className="mt-1 text-sm text-gray-600">Create reusable sidebars for blog and shop pages.</p>
        </div>
        <button type="button" onClick={saveSidebars} disabled={saving || loading} className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Sidebars'}
        </button>
      </div>

      {error && <p className="mb-4 rounded bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {message && <p className="mb-4 rounded bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}

      <div className="mb-5 flex gap-2">
        {(['blog', 'shop'] as const).map((sidebar) => (
          <button
            key={sidebar}
            type="button"
            onClick={() => setActiveSidebar(sidebar)}
            className={`rounded border px-4 py-2 text-sm capitalize ${activeSidebar === sidebar ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'bg-white hover:bg-gray-50'}`}
          >
            {sidebar} Sidebar
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="space-y-3">
          {widgets.map((widget, index) => (
            <div key={widget.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)_auto] md:items-end">
                <label className="block text-sm font-medium text-gray-700">
                  Widget Type
                  <select value={widget.type} onChange={(event) => updateWidget(index, { type: event.target.value as SiteSidebarWidgetType })} className="mt-1 w-full rounded border px-3 py-2 text-sm">
                    {WIDGET_TYPES.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Title
                  <input value={widget.title} onChange={(event) => updateWidget(index, { title: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
                </label>
                <button type="button" onClick={() => updateWidgets(widgets.filter((_, widgetIndex) => widgetIndex !== index))} className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100">
                  Remove
                </button>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={widget.enabled} onChange={(event) => updateWidget(index, { enabled: event.target.checked })} />
                Show this widget
              </label>
            </div>
          ))}
        </section>

        <aside className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Add Widget</h2>
          <div className="mt-4 grid gap-2">
            {WIDGET_TYPES.map((item) => (
              <button key={item.type} type="button" onClick={() => addWidget(item.type)} className="rounded border px-3 py-2 text-left text-sm hover:border-indigo-300 hover:bg-indigo-50">
                {item.label}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function normalizeSidebars(value: unknown): SiteSidebarsSettings {
  if (typeof value === 'string') {
    try {
      return normalizeSidebars(JSON.parse(value));
    } catch {
      return DEFAULT_SITE_SIDEBARS;
    }
  }
  if (!value || typeof value !== 'object') return DEFAULT_SITE_SIDEBARS;
  const candidate = value as Partial<SiteSidebarsSettings>;
  return {
    blog: Array.isArray(candidate.blog) ? candidate.blog : DEFAULT_SITE_SIDEBARS.blog,
    shop: Array.isArray(candidate.shop) ? candidate.shop : DEFAULT_SITE_SIDEBARS.shop,
  };
}

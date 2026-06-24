'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface MenuItem {
  id: string;
  label: string;
  href: string;
}

interface SavedMenu {
  id: string;
  name: string;
  location: 'header' | 'footer' | 'sidebar' | 'custom';
  items: MenuItem[];
}

interface MenusForm {
  header: MenuItem[];
  footer: MenuItem[];
  custom: SavedMenu[];
}

const emptyMenusForm: MenusForm = {
  header: [
    { id: 'header-home', label: 'Home', href: '/' },
    { id: 'header-blog', label: 'Blog', href: '/blog' },
    { id: 'header-shop', label: 'Shop', href: '/shop' },
  ],
  footer: [
    { id: 'footer-home', label: 'Home', href: '/' },
    { id: 'footer-blog', label: 'Blog', href: '/blog' },
  ],
  custom: [],
};

export default function AdminMenusPage() {
  const [menus, setMenus] = useState<MenusForm>(emptyMenusForm);
  const [selectedMenuId, setSelectedMenuId] = useState('header');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const menuList = useMemo(
    () => [
      { id: 'header', name: 'Header Menu', location: 'header' as const, items: menus.header },
      { id: 'footer', name: 'Footer Menu', location: 'footer' as const, items: menus.footer },
      ...menus.custom,
    ],
    [menus],
  );
  const selectedMenu = menuList.find((menu) => menu.id === selectedMenuId) ?? menuList[0];

  const fetchMenus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/proxy/settings/site_menus');
      if (!res.ok && res.status !== 404) throw new Error('Could not load menus');
      const setting = res.ok ? ((await res.json()) as { value?: string } | null) : null;
      setMenus(normalizeMenus(setting?.value));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load menus');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMenus();
  }, [fetchMenus]);

  function createMenu() {
    const menu: SavedMenu = {
      id: createId('menu'),
      name: 'New Menu',
      location: 'custom',
      items: [{ id: createId('item'), label: 'New Link', href: '/' }],
    };
    setMenus((current) => ({ ...current, custom: [...current.custom, menu] }));
    setSelectedMenuId(menu.id);
    setMessage('');
    setError('');
  }

  function updateSelectedMenu(nextMenu: SavedMenu) {
    if (nextMenu.id === 'header') {
      setMenus((current) => ({ ...current, header: nextMenu.items }));
      return;
    }
    if (nextMenu.id === 'footer') {
      setMenus((current) => ({ ...current, footer: nextMenu.items }));
      return;
    }
    setMenus((current) => ({
      ...current,
      custom: current.custom.map((menu) => (menu.id === nextMenu.id ? nextMenu : menu)),
    }));
  }

  function deleteSelectedMenu() {
    if (!selectedMenu || selectedMenu.id === 'header' || selectedMenu.id === 'footer') return;
    if (!confirm('Delete this menu?')) return;
    setMenus((current) => ({ ...current, custom: current.custom.filter((menu) => menu.id !== selectedMenu.id) }));
    setSelectedMenuId('header');
  }

  async function saveMenus() {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const payload = {
        header: menus.header.map(({ label, href }) => ({ label, href })),
        footer: menus.footer.map(({ label, href }) => ({ label, href })),
        custom: menus.custom.map((menu) => ({
          id: menu.id,
          name: menu.name,
          location: menu.location,
          items: menu.items.map(({ label, href }) => ({ label, href })),
        })),
      };
      const res = await fetch('/api/proxy/settings/site_menus', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(payload) }),
      });
      if (!res.ok) throw new Error('Could not save menus');
      setMessage('Menus saved.');
      await fetchMenus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save menus');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Menus</h1>
          <p className="mt-1 text-sm text-gray-600">Create saved menus that can be used in page editor menu widgets.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={createMenu} className="rounded border border-gray-200 bg-white px-4 py-2 text-sm hover:bg-gray-50">
            New Menu
          </button>
          <button type="button" onClick={saveMenus} disabled={saving} className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Menus'}
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {message && <p className="mb-4 rounded bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Saved Menus</h2>
          {loading ? (
            <p className="mt-4 text-sm text-gray-500">Loading...</p>
          ) : (
            <div className="mt-4 space-y-2">
              {menuList.map((menu) => (
                <button
                  key={menu.id}
                  type="button"
                  onClick={() => setSelectedMenuId(menu.id)}
                  className={`w-full rounded-lg border px-3 py-3 text-left text-sm ${selectedMenuId === menu.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  <span className="block font-medium text-gray-900">{menu.name}</span>
                  <span className="mt-1 block text-xs text-gray-500">{menu.location} - {menu.items.length} links</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        {selectedMenu && (
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{selectedMenu.name}</h2>
                <p className="mt-1 text-sm text-gray-500">Add the links you want this menu to display.</p>
              </div>
              {selectedMenu.id !== 'header' && selectedMenu.id !== 'footer' && (
                <button type="button" onClick={deleteSelectedMenu} className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100">
                  Delete Menu
                </button>
              )}
            </div>

            <div className="mb-5 grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-gray-700">
                Menu Name
                <input
                  value={selectedMenu.name}
                  disabled={selectedMenu.id === 'header' || selectedMenu.id === 'footer'}
                  onChange={(event) => updateSelectedMenu({ ...selectedMenu, name: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Placement
                <select
                  value={selectedMenu.location}
                  onChange={(event) => updateSelectedMenu({ ...selectedMenu, location: event.target.value as SavedMenu['location'] })}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="header">Header</option>
                  <option value="footer">Footer</option>
                  <option value="sidebar">Sidebar</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
            </div>

            <div className="space-y-3">
              {selectedMenu.items.map((item, index) => (
                <div key={item.id} className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <label className="block text-xs font-medium text-gray-600">
                    Label
                    <input
                      value={item.label}
                      onChange={(event) => updateSelectedMenu({ ...selectedMenu, items: updateItem(selectedMenu.items, index, { label: event.target.value }) })}
                      className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-xs font-medium text-gray-600">
                    Link
                    <input
                      value={item.href}
                      onChange={(event) => updateSelectedMenu({ ...selectedMenu, items: updateItem(selectedMenu.items, index, { href: event.target.value }) })}
                      className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm"
                      placeholder="/shop"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => updateSelectedMenu({ ...selectedMenu, items: selectedMenu.items.filter((_, itemIndex) => itemIndex !== index) })}
                    className="self-end rounded border border-red-200 bg-white px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => updateSelectedMenu({ ...selectedMenu, items: [...selectedMenu.items, { id: createId('item'), label: 'New Link', href: '/' }] })}
              className="mt-4 rounded border border-gray-200 bg-white px-4 py-2 text-sm hover:bg-gray-50"
            >
              Add Link
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

function normalizeMenus(value: unknown): MenusForm {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = null;
    }
  }
  if (!parsed || typeof parsed !== 'object') return emptyMenusForm;
  const source = parsed as { header?: unknown; footer?: unknown; custom?: unknown };
  return {
    header: normalizeItems(source.header, emptyMenusForm.header),
    footer: normalizeItems(source.footer, emptyMenusForm.footer),
    custom: Array.isArray(source.custom)
      ? source.custom.map(normalizeCustomMenu).filter((menu): menu is SavedMenu => menu !== null)
      : [],
  };
}

function normalizeCustomMenu(value: unknown, index: number): SavedMenu | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { id?: unknown; name?: unknown; location?: unknown; items?: unknown };
  return {
    id: String(candidate.id ?? `custom-${index + 1}`),
    name: String(candidate.name ?? `Custom Menu ${index + 1}`),
    location: normalizeLocation(candidate.location),
    items: normalizeItems(candidate.items, []),
  };
}

function normalizeItems(value: unknown, fallback: MenuItem[]): MenuItem[] {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as { id?: unknown; label?: unknown; href?: unknown };
      const label = String(candidate.label ?? '').trim();
      const href = String(candidate.href ?? '').trim();
      if (!label || !href) return null;
      return { id: String(candidate.id ?? createId('item')), label, href };
    })
    .filter((item): item is MenuItem => item !== null);
  return items.length > 0 ? items : fallback;
}

function normalizeLocation(value: unknown): SavedMenu['location'] {
  return value === 'header' || value === 'footer' || value === 'sidebar' || value === 'custom' ? value : 'custom';
}

function updateItem(items: MenuItem[], index: number, patch: Partial<MenuItem>) {
  return items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item));
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

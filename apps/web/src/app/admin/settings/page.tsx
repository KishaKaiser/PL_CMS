'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface Setting {
  key: string;
  value: string;
}

interface PageSummary {
  id: string;
  slug: string;
  title: string;
  publishedAt: string | null;
}

interface MenuItem {
  label: string;
  href: string;
}

interface SiteIdentityForm {
  title: string;
  tagline: string;
  logoUrl: string;
  footerText: string;
}

interface SiteHomepageForm {
  mode: 'landing' | 'latest_posts' | 'page';
  pageSlug: string;
}

interface SitePostsPageForm {
  type: 'default' | 'page';
  pageSlug: string;
}

interface ThemeSectionForm {
  enabled: boolean;
  title: string;
}

interface SiteThemeForm {
  primaryColor: string;
  accentColor: string;
  heroTitle: string;
  heroBody: string;
  heroPrimaryLabel: string;
  heroPrimaryHref: string;
  heroSecondaryLabel: string;
  heroSecondaryHref: string;
  homepageSections: {
    pages: ThemeSectionForm;
    posts: ThemeSectionForm;
  };
}

interface SiteMenusForm {
  header: MenuItem[];
  footer: MenuItem[];
}

const SITE_IDENTITY_KEY = 'site_identity';
const SITE_HOMEPAGE_KEY = 'site_homepage';
const SITE_POSTS_PAGE_KEY = 'site_posts_page';
const SITE_MENUS_KEY = 'site_menus';
const SITE_THEME_KEY = 'site_theme';

const defaultIdentityForm: SiteIdentityForm = {
  title: 'Psychic Link CMS',
  tagline: 'Public CMS frontend powered by published content.',
  logoUrl: '',
  footerText: 'Browse published pages and blog posts managed in the CMS.',
};

const defaultHomepageForm: SiteHomepageForm = {
  mode: 'landing',
  pageSlug: '',
};

const defaultPostsPageForm: SitePostsPageForm = {
  type: 'default',
  pageSlug: '',
};

const defaultThemeForm: SiteThemeForm = {
  primaryColor: '#4f46e5',
  accentColor: '#7c3aed',
  heroTitle: 'Psychic Link CMS',
  heroBody: 'Welcome to the public site. Read our latest posts or browse CMS pages.',
  heroPrimaryLabel: 'Visit Blog',
  heroPrimaryHref: '',
  heroSecondaryLabel: 'Admin',
  heroSecondaryHref: '/admin',
  homepageSections: {
    pages: {
      enabled: true,
      title: 'Browse Pages',
    },
    posts: {
      enabled: true,
      title: 'Latest Posts',
    },
  },
};

const defaultMenusForm: SiteMenusForm = {
  header: [
    { label: 'Home', href: '/' },
    { label: 'Blog', href: '/blog' },
  ],
  footer: [
    { label: 'Home', href: '/' },
    { label: 'Blog', href: '/blog' },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseJsonValue<T>(value: string | undefined): T | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function readBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeMenuItems(value: unknown, fallback: MenuItem[]) {
  if (!Array.isArray(value)) return fallback;

  const items = value
    .map((item) => {
      if (!isRecord(item)) return null;

      const label = readString(item.label).trim();
      const href = readString(item.href ?? item.url).trim();

      if (!label || !href) return null;
      return { label, href };
    })
    .filter((item): item is MenuItem => item !== null);

  return items.length > 0 ? items : fallback;
}

function findSetting(settings: Setting[], key: string) {
  return settings.find((setting) => setting.key === key)?.value;
}

function MenuEditor({
  title,
  items,
  onChange,
}: {
  title: string;
  items: MenuItem[];
  onChange: (items: MenuItem[]) => void;
}) {
  function updateItem(index: number, field: keyof MenuItem, value: string) {
    onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)));
  }

  function removeItem(index: number) {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <button
          type="button"
          onClick={() => onChange([...items, { label: '', href: '' }])}
          className="rounded border border-gray-200 px-3 py-1 text-xs font-medium hover:bg-gray-50"
        >
          Add item
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={`${title}-${index}`} className="grid gap-3 rounded-lg border border-dashed border-gray-200 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <input
              value={item.label}
              onChange={(event) => updateItem(index, 'label', event.target.value)}
              placeholder="Label"
              className="rounded border px-3 py-2 text-sm"
            />
            <input
              value={item.href}
              onChange={(event) => updateItem(index, 'href', event.target.value)}
              placeholder="/path or https://example.com"
              className="rounded border px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="rounded border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [identityForm, setIdentityForm] = useState<SiteIdentityForm>(defaultIdentityForm);
  const [homepageForm, setHomepageForm] = useState<SiteHomepageForm>(defaultHomepageForm);
  const [postsPageForm, setPostsPageForm] = useState<SitePostsPageForm>(defaultPostsPageForm);
  const [themeForm, setThemeForm] = useState<SiteThemeForm>(defaultThemeForm);
  const [menusForm, setMenusForm] = useState<SiteMenusForm>(defaultMenusForm);

  const publishedPages = useMemo(
    () => pages.filter((page) => Boolean(page.publishedAt)),
    [pages],
  );

  const hydrateManagedForms = useCallback((allSettings: Setting[]) => {
    const identity = parseJsonValue<Record<string, unknown>>(findSetting(allSettings, SITE_IDENTITY_KEY));
    const homepage = parseJsonValue<Record<string, unknown>>(findSetting(allSettings, SITE_HOMEPAGE_KEY));
    const postsPage = parseJsonValue<Record<string, unknown>>(findSetting(allSettings, SITE_POSTS_PAGE_KEY));
    const theme = parseJsonValue<Record<string, unknown>>(findSetting(allSettings, SITE_THEME_KEY));
    const menus = parseJsonValue<Record<string, unknown>>(findSetting(allSettings, SITE_MENUS_KEY));
    const homepageSections = isRecord(theme?.homepageSections) ? theme.homepageSections : null;
    const pageSection = isRecord(homepageSections?.pages) ? homepageSections.pages : null;
    const postSection = isRecord(homepageSections?.posts) ? homepageSections.posts : null;

    setIdentityForm({
      title: readString(identity?.title, defaultIdentityForm.title),
      tagline: readString(identity?.tagline, defaultIdentityForm.tagline),
      logoUrl: readString(identity?.logoUrl, defaultIdentityForm.logoUrl),
      footerText: readString(identity?.footerText, defaultIdentityForm.footerText),
    });
    setHomepageForm({
      mode:
        homepage?.mode === 'page' || homepage?.mode === 'latest_posts'
          ? homepage.mode
          : defaultHomepageForm.mode,
      pageSlug: readString(homepage?.pageSlug, defaultHomepageForm.pageSlug),
    });
    setPostsPageForm({
      type: postsPage?.type === 'page' ? 'page' : defaultPostsPageForm.type,
      pageSlug: readString(postsPage?.pageSlug, defaultPostsPageForm.pageSlug),
    });
    setThemeForm({
      primaryColor: readString(theme?.primaryColor, defaultThemeForm.primaryColor),
      accentColor: readString(theme?.accentColor, defaultThemeForm.accentColor),
      heroTitle: readString(theme?.heroTitle, defaultThemeForm.heroTitle),
      heroBody: readString(theme?.heroBody, defaultThemeForm.heroBody),
      heroPrimaryLabel: readString(theme?.heroPrimaryLabel, defaultThemeForm.heroPrimaryLabel),
      heroPrimaryHref: readString(theme?.heroPrimaryHref, defaultThemeForm.heroPrimaryHref),
      heroSecondaryLabel: readString(theme?.heroSecondaryLabel, defaultThemeForm.heroSecondaryLabel),
      heroSecondaryHref: readString(theme?.heroSecondaryHref, defaultThemeForm.heroSecondaryHref),
      homepageSections: {
        pages: {
          enabled: readBoolean(pageSection?.enabled, defaultThemeForm.homepageSections.pages.enabled),
          title: readString(pageSection?.title, defaultThemeForm.homepageSections.pages.title),
        },
        posts: {
          enabled: readBoolean(postSection?.enabled, defaultThemeForm.homepageSections.posts.enabled),
          title: readString(postSection?.title, defaultThemeForm.homepageSections.posts.title),
        },
      },
    });
    setMenusForm({
      header: normalizeMenuItems(menus?.header, defaultMenusForm.header),
      footer: normalizeMenuItems(menus?.footer, defaultMenusForm.footer),
    });
  }, []);

  const applySettingUpdate = useCallback((updated: Setting) => {
    setSettings((currentSettings) => {
      const without = currentSettings.filter((setting) => setting.key !== updated.key);
      return [...without, updated].sort((a, b) => a.key.localeCompare(b.key));
    });
    setEditValues((currentValues) => ({ ...currentValues, [updated.key]: updated.value }));
  }, []);

  const upsertSetting = useCallback(async (key: string, value: string) => {
    const res = await fetch(`/api/proxy/settings/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });

    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(payload.message ?? 'Save failed');
    }

    const updated = (await res.json()) as Setting;
    applySettingUpdate(updated);
    return updated;
  }, [applySettingUpdate]);

  const fetchSettings = useCallback(async () => {
    setLoading(true);

    try {
      const [settingsRes, pagesRes] = await Promise.all([
        fetch('/api/proxy/settings'),
        fetch('/api/proxy/pages'),
      ]);

      if (!settingsRes.ok) throw new Error('Failed to load settings');
      if (!pagesRes.ok) throw new Error('Failed to load pages');

      const settingsData = (await settingsRes.json()) as Setting[];
      const pagesData = (await pagesRes.json()) as PageSummary[];
      const values: Record<string, string> = {};

      settingsData.forEach((setting) => {
        values[setting.key] = setting.value;
      });

      setSettings(settingsData);
      setPages(pagesData);
      setEditValues(values);
      hydrateManagedForms(settingsData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [hydrateManagedForms]);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  async function handleSave(key: string) {
    setSaving((currentSaving) => ({ ...currentSaving, [key]: true }));
    setError('');

    try {
      await upsertSetting(key, editValues[key]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error saving setting');
    } finally {
      setSaving((currentSaving) => ({ ...currentSaving, [key]: false }));
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError('');

    try {
      await upsertSetting(newKey, newValue);
      setNewKey('');
      setNewValue('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setAdding(false);
    }
  }

  async function saveManagedSetting(key: string, value: unknown) {
    setSaving((currentSaving) => ({ ...currentSaving, [key]: true }));
    setError('');

    try {
      await upsertSetting(key, JSON.stringify(value));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error saving setting');
    } finally {
      setSaving((currentSaving) => ({ ...currentSaving, [key]: false }));
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage the public homepage, blog route, navigation, branding, and lightweight theme options.
        </p>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <div className="space-y-8">
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Homepage &amp; blog route</h2>
            <p className="text-sm text-gray-500">
              Choose how the public homepage behaves and which route acts as the main blog listing.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4 rounded-lg border border-gray-200 p-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Homepage behavior</label>
                <select
                  value={homepageForm.mode}
                  onChange={(event) =>
                    setHomepageForm((currentForm) => ({
                      ...currentForm,
                      mode: event.target.value as SiteHomepageForm['mode'],
                    }))
                  }
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                >
                  <option value="landing">Theme landing page</option>
                  <option value="latest_posts">Latest posts feed</option>
                  <option value="page">Published page</option>
                </select>
              </div>

              {homepageForm.mode === 'page' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Homepage page</label>
                  <select
                    value={homepageForm.pageSlug}
                    onChange={(event) =>
                      setHomepageForm((currentForm) => ({
                        ...currentForm,
                        pageSlug: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  >
                    <option value="">Select a published page</option>
                    {publishedPages.map((page) => (
                      <option key={page.id} value={page.slug}>
                        {page.title} ({page.slug})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-4 rounded-lg border border-gray-200 p-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Posts page route</label>
                <select
                  value={postsPageForm.type === 'page' ? postsPageForm.pageSlug : '__default__'}
                  onChange={(event) => {
                    const value = event.target.value;
                    setPostsPageForm(
                      value === '__default__'
                        ? { type: 'default', pageSlug: '' }
                        : { type: 'page', pageSlug: value },
                    );
                  }}
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                >
                  <option value="__default__">Default /blog route</option>
                  {publishedPages.map((page) => (
                    <option key={page.id} value={page.slug}>
                      {page.title} → /{page.slug}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-500">
                When you choose a page route, that slug becomes the public blog index while single post URLs remain under /blog.
              </p>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() =>
                void Promise.all([
                  saveManagedSetting(SITE_HOMEPAGE_KEY, homepageForm),
                  saveManagedSetting(SITE_POSTS_PAGE_KEY, postsPageForm),
                ])
              }
              disabled={saving[SITE_HOMEPAGE_KEY] || saving[SITE_POSTS_PAGE_KEY] || loading}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving[SITE_HOMEPAGE_KEY] || saving[SITE_POSTS_PAGE_KEY] ? 'Saving…' : 'Save homepage & route'}
            </button>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Site identity</h2>
            <p className="text-sm text-gray-500">Update the visible brand content used in the public header, footer, and hero areas.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Site title</label>
              <input
                value={identityForm.title}
                onChange={(event) => setIdentityForm((currentForm) => ({ ...currentForm, title: event.target.value }))}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Tagline</label>
              <input
                value={identityForm.tagline}
                onChange={(event) => setIdentityForm((currentForm) => ({ ...currentForm, tagline: event.target.value }))}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Logo URL</label>
              <input
                value={identityForm.logoUrl}
                onChange={(event) => setIdentityForm((currentForm) => ({ ...currentForm, logoUrl: event.target.value }))}
                placeholder="https://example.com/logo.png"
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Footer text</label>
              <textarea
                value={identityForm.footerText}
                onChange={(event) => setIdentityForm((currentForm) => ({ ...currentForm, footerText: event.target.value }))}
                rows={3}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => void saveManagedSetting(SITE_IDENTITY_KEY, identityForm)}
              disabled={saving[SITE_IDENTITY_KEY] || loading}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving[SITE_IDENTITY_KEY] ? 'Saving…' : 'Save site identity'}
            </button>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Navigation menus</h2>
            <p className="text-sm text-gray-500">Manage the links shown in the public header and footer.</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <MenuEditor
              title="Header menu"
              items={menusForm.header}
              onChange={(header) => setMenusForm((currentForm) => ({ ...currentForm, header }))}
            />
            <MenuEditor
              title="Footer menu"
              items={menusForm.footer}
              onChange={(footer) => setMenusForm((currentForm) => ({ ...currentForm, footer }))}
            />
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => void saveManagedSetting(SITE_MENUS_KEY, menusForm)}
              disabled={saving[SITE_MENUS_KEY] || loading}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving[SITE_MENUS_KEY] ? 'Saving…' : 'Save menus'}
            </button>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Theme options</h2>
            <p className="text-sm text-gray-500">Set lightweight presentation controls for colors, hero copy, and homepage sections.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Primary color</label>
              <input
                type="color"
                value={themeForm.primaryColor}
                onChange={(event) => setThemeForm((currentForm) => ({ ...currentForm, primaryColor: event.target.value }))}
                className="mt-1 h-11 w-full rounded border px-2 py-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Accent color</label>
              <input
                type="color"
                value={themeForm.accentColor}
                onChange={(event) => setThemeForm((currentForm) => ({ ...currentForm, accentColor: event.target.value }))}
                className="mt-1 h-11 w-full rounded border px-2 py-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Hero title</label>
              <input
                value={themeForm.heroTitle}
                onChange={(event) => setThemeForm((currentForm) => ({ ...currentForm, heroTitle: event.target.value }))}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Hero primary button label</label>
              <input
                value={themeForm.heroPrimaryLabel}
                onChange={(event) => setThemeForm((currentForm) => ({ ...currentForm, heroPrimaryLabel: event.target.value }))}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Hero body</label>
              <textarea
                value={themeForm.heroBody}
                onChange={(event) => setThemeForm((currentForm) => ({ ...currentForm, heroBody: event.target.value }))}
                rows={3}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Hero primary button link</label>
              <input
                value={themeForm.heroPrimaryHref}
                onChange={(event) => setThemeForm((currentForm) => ({ ...currentForm, heroPrimaryHref: event.target.value }))}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Hero secondary button label</label>
              <input
                value={themeForm.heroSecondaryLabel}
                onChange={(event) => setThemeForm((currentForm) => ({ ...currentForm, heroSecondaryLabel: event.target.value }))}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Hero secondary button link</label>
              <input
                value={themeForm.heroSecondaryHref}
                onChange={(event) => setThemeForm((currentForm) => ({ ...currentForm, heroSecondaryHref: event.target.value }))}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={themeForm.homepageSections.pages.enabled}
                  onChange={(event) =>
                    setThemeForm((currentForm) => ({
                      ...currentForm,
                      homepageSections: {
                        ...currentForm.homepageSections,
                        pages: {
                          ...currentForm.homepageSections.pages,
                          enabled: event.target.checked,
                        },
                      },
                    }))
                  }
                />
                Show pages section on landing homepage
              </label>
              <input
                value={themeForm.homepageSections.pages.title}
                onChange={(event) =>
                  setThemeForm((currentForm) => ({
                    ...currentForm,
                    homepageSections: {
                      ...currentForm.homepageSections,
                      pages: {
                        ...currentForm.homepageSections.pages,
                        title: event.target.value,
                      },
                    },
                  }))
                }
                className="mt-3 w-full rounded border px-3 py-2 text-sm"
                placeholder="Pages section title"
              />
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={themeForm.homepageSections.posts.enabled}
                  onChange={(event) =>
                    setThemeForm((currentForm) => ({
                      ...currentForm,
                      homepageSections: {
                        ...currentForm.homepageSections,
                        posts: {
                          ...currentForm.homepageSections.posts,
                          enabled: event.target.checked,
                        },
                      },
                    }))
                  }
                />
                Show posts section on landing homepage
              </label>
              <input
                value={themeForm.homepageSections.posts.title}
                onChange={(event) =>
                  setThemeForm((currentForm) => ({
                    ...currentForm,
                    homepageSections: {
                      ...currentForm.homepageSections,
                      posts: {
                        ...currentForm.homepageSections.posts,
                        title: event.target.value,
                      },
                    },
                  }))
                }
                className="mt-3 w-full rounded border px-3 py-2 text-sm"
                placeholder="Posts section title"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => void saveManagedSetting(SITE_THEME_KEY, themeForm)}
              disabled={saving[SITE_THEME_KEY] || loading}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving[SITE_THEME_KEY] ? 'Saving…' : 'Save theme options'}
            </button>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Add setting</h2>
          <form onSubmit={handleAdd} className="flex flex-col gap-3 md:flex-row">
            <input
              required
              value={newKey}
              onChange={(event) => setNewKey(event.target.value)}
              placeholder="Key"
              className="flex-1 rounded border px-3 py-2 text-sm font-mono"
            />
            <input
              required
              value={newValue}
              onChange={(event) => setNewValue(event.target.value)}
              placeholder="Value"
              className="flex-1 rounded border px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={adding}
              className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {adding ? 'Adding…' : 'Add'}
            </button>
          </form>
        </section>

        <section>
          <div className="mb-3">
            <h2 className="text-lg font-semibold">All settings</h2>
            <p className="text-sm text-gray-500">Advanced raw setting values remain available below.</p>
          </div>
          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : settings.length === 0 ? (
            <p className="text-gray-500">No settings yet.</p>
          ) : (
            <div className="space-y-2">
              {settings.map((setting) => (
                <div key={setting.key} className="flex flex-col gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm md:flex-row md:items-center">
                  <span className="w-48 shrink-0 font-mono text-sm font-medium text-gray-700">{setting.key}</span>
                  <input
                    value={editValues[setting.key] ?? setting.value}
                    onChange={(event) => setEditValues((currentValues) => ({ ...currentValues, [setting.key]: event.target.value }))}
                    className="flex-1 rounded border px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => void handleSave(setting.key)}
                    disabled={saving[setting.key]}
                    className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving[setting.key] ? 'Saving…' : 'Save'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

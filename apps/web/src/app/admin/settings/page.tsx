'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_HOMEPAGE_SETTINGS,
  DEFAULT_POSTS_PAGE_SETTINGS,
  DEFAULT_SITE_EXTENSION_POINTS,
  DEFAULT_SITE_IDENTITY,
  DEFAULT_SITE_THEME,
  SITE_SETTING_KEYS,
  buildDefaultHomepageBlocks,
} from '@pl-cms/shared';

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

interface SiteIdentityForm {
  title: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  footerText: string;
}

interface BillingApiForm {
  provider: 'manual' | 'paypal' | 'stripe';
  environment: 'sandbox' | 'live';
  paypalClientId: string;
  paypalClientSecret: string;
  stripePublishableKey: string;
  stripeSecretKey: string;
  webhookSecret: string;
}

interface ShippingApiForm {
  provider: 'manual' | 'shipstation' | 'shippo' | 'easypost';
  apiKey: string;
  apiSecret: string;
  accountId: string;
  originPostalCode: string;
  originCountry: string;
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
  blogSidebar: {
    search: ThemeSectionForm;
    categories: ThemeSectionForm;
    tags: ThemeSectionForm;
    authors: ThemeSectionForm;
    archives: ThemeSectionForm;
  };
}

const SITE_IDENTITY_KEY = SITE_SETTING_KEYS.SITE_IDENTITY;
const SITE_HOMEPAGE_KEY = SITE_SETTING_KEYS.SITE_HOMEPAGE;
const SITE_POSTS_PAGE_KEY = SITE_SETTING_KEYS.SITE_POSTS_PAGE;
const SITE_THEME_KEY = SITE_SETTING_KEYS.SITE_THEME;
const SITE_HOMEPAGE_BLOCKS_KEY = SITE_SETTING_KEYS.SITE_HOMEPAGE_BLOCKS;
const SITE_EXTENSION_POINTS_KEY = SITE_SETTING_KEYS.SITE_EXTENSION_POINTS;
const BILLING_API_SETTINGS_KEY = 'billing_api_settings';
const SHIPPING_API_SETTINGS_KEY = 'shipping_api_settings';

const defaultIdentityForm: SiteIdentityForm = {
  ...DEFAULT_SITE_IDENTITY,
};

const defaultBillingApiForm: BillingApiForm = {
  provider: 'manual',
  environment: 'sandbox',
  paypalClientId: '',
  paypalClientSecret: '',
  stripePublishableKey: '',
  stripeSecretKey: '',
  webhookSecret: '',
};

const defaultShippingApiForm: ShippingApiForm = {
  provider: 'manual',
  apiKey: '',
  apiSecret: '',
  accountId: '',
  originPostalCode: '',
  originCountry: 'US',
};

const defaultHomepageForm: SiteHomepageForm = {
  ...DEFAULT_HOMEPAGE_SETTINGS,
};

const defaultPostsPageForm: SitePostsPageForm = {
  ...DEFAULT_POSTS_PAGE_SETTINGS,
};

const defaultThemeForm: SiteThemeForm = {
  ...DEFAULT_SITE_THEME,
};

const defaultHomepageBlocks = buildDefaultHomepageBlocks('/blog');

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

function readOption<T extends string>(value: unknown, options: readonly T[], fallback: T) {
  return typeof value === 'string' && options.includes(value as T) ? (value as T) : fallback;
}

function findSetting(settings: Setting[], key: string) {
  return settings.find((setting) => setting.key === key)?.value;
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
  const [billingApiForm, setBillingApiForm] = useState<BillingApiForm>(defaultBillingApiForm);
  const [shippingApiForm, setShippingApiForm] = useState<ShippingApiForm>(defaultShippingApiForm);

  const publishedPages = useMemo(
    () => pages.filter((page) => Boolean(page.publishedAt)),
    [pages],
  );

  const hydrateManagedForms = useCallback((allSettings: Setting[]) => {
    const identity = parseJsonValue<Record<string, unknown>>(findSetting(allSettings, SITE_IDENTITY_KEY));
    const homepage = parseJsonValue<Record<string, unknown>>(findSetting(allSettings, SITE_HOMEPAGE_KEY));
    const postsPage = parseJsonValue<Record<string, unknown>>(findSetting(allSettings, SITE_POSTS_PAGE_KEY));
    const theme = parseJsonValue<Record<string, unknown>>(findSetting(allSettings, SITE_THEME_KEY));
    const billingApi = parseJsonValue<Record<string, unknown>>(findSetting(allSettings, BILLING_API_SETTINGS_KEY));
    const shippingApi = parseJsonValue<Record<string, unknown>>(findSetting(allSettings, SHIPPING_API_SETTINGS_KEY));
    const homepageSections = isRecord(theme?.homepageSections) ? theme.homepageSections : null;
    const pageSection = isRecord(homepageSections?.pages) ? homepageSections.pages : null;
    const postSection = isRecord(homepageSections?.posts) ? homepageSections.posts : null;
    const blogSidebar = isRecord(theme?.blogSidebar) ? theme.blogSidebar : null;
    const blogSidebarSection = (key: keyof SiteThemeForm['blogSidebar']) => isRecord(blogSidebar?.[key]) ? blogSidebar[key] as Record<string, unknown> : null;

    setIdentityForm({
      title: readString(identity?.title, defaultIdentityForm.title),
      tagline: readString(identity?.tagline, defaultIdentityForm.tagline),
      logoUrl: readString(identity?.logoUrl, defaultIdentityForm.logoUrl),
      faviconUrl: readString(identity?.faviconUrl, defaultIdentityForm.faviconUrl),
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
      blogSidebar: {
        search: {
          enabled: readBoolean(blogSidebarSection('search')?.enabled, defaultThemeForm.blogSidebar.search.enabled),
          title: readString(blogSidebarSection('search')?.title, defaultThemeForm.blogSidebar.search.title),
        },
        categories: {
          enabled: readBoolean(blogSidebarSection('categories')?.enabled, defaultThemeForm.blogSidebar.categories.enabled),
          title: readString(blogSidebarSection('categories')?.title, defaultThemeForm.blogSidebar.categories.title),
        },
        tags: {
          enabled: readBoolean(blogSidebarSection('tags')?.enabled, defaultThemeForm.blogSidebar.tags.enabled),
          title: readString(blogSidebarSection('tags')?.title, defaultThemeForm.blogSidebar.tags.title),
        },
        authors: {
          enabled: readBoolean(blogSidebarSection('authors')?.enabled, defaultThemeForm.blogSidebar.authors.enabled),
          title: readString(blogSidebarSection('authors')?.title, defaultThemeForm.blogSidebar.authors.title),
        },
        archives: {
          enabled: readBoolean(blogSidebarSection('archives')?.enabled, defaultThemeForm.blogSidebar.archives.enabled),
          title: readString(blogSidebarSection('archives')?.title, defaultThemeForm.blogSidebar.archives.title),
        },
      },
    });
    setBillingApiForm({
      provider: readOption(billingApi?.provider, ['manual', 'paypal', 'stripe'] as const, defaultBillingApiForm.provider),
      environment: readOption(billingApi?.environment, ['sandbox', 'live'] as const, defaultBillingApiForm.environment),
      paypalClientId: readString(billingApi?.paypalClientId, defaultBillingApiForm.paypalClientId),
      paypalClientSecret: readString(billingApi?.paypalClientSecret, defaultBillingApiForm.paypalClientSecret),
      stripePublishableKey: readString(billingApi?.stripePublishableKey, defaultBillingApiForm.stripePublishableKey),
      stripeSecretKey: readString(billingApi?.stripeSecretKey, defaultBillingApiForm.stripeSecretKey),
      webhookSecret: readString(billingApi?.webhookSecret, defaultBillingApiForm.webhookSecret),
    });
    setShippingApiForm({
      provider: readOption(shippingApi?.provider, ['manual', 'shipstation', 'shippo', 'easypost'] as const, defaultShippingApiForm.provider),
      apiKey: readString(shippingApi?.apiKey, defaultShippingApiForm.apiKey),
      apiSecret: readString(shippingApi?.apiSecret, defaultShippingApiForm.apiSecret),
      accountId: readString(shippingApi?.accountId, defaultShippingApiForm.accountId),
      originPostalCode: readString(shippingApi?.originPostalCode, defaultShippingApiForm.originPostalCode),
      originCountry: readString(shippingApi?.originCountry, defaultShippingApiForm.originCountry),
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
            <h2 className="text-lg font-semibold">Homepage & blog route</h2>
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
                  <p className="mt-2 text-xs text-gray-500">
                    If the selected page is later unpublished or removed, the public homepage falls back to the landing layout.
                  </p>
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
              <label className="block text-sm font-medium text-gray-700">Favicon URL</label>
              <input
                value={identityForm.faviconUrl}
                onChange={(event) => setIdentityForm((currentForm) => ({ ...currentForm, faviconUrl: event.target.value }))}
                placeholder="https://example.com/favicon.ico"
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
            <h2 className="text-lg font-semibold">API settings</h2>
            <p className="text-sm text-gray-500">Store billing and shipping provider credentials used by checkout and fulfillment features.</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4 rounded-lg border border-gray-200 p-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Billing</h3>
                <p className="text-xs text-gray-500">Choose a payment provider and keep its credentials together.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium text-gray-700">
                  Provider
                  <select
                    value={billingApiForm.provider}
                    onChange={(event) =>
                      setBillingApiForm((currentForm) => ({
                        ...currentForm,
                        provider: event.target.value as BillingApiForm['provider'],
                      }))
                    }
                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  >
                    <option value="manual">Manual</option>
                    <option value="paypal">PayPal</option>
                    <option value="stripe">Stripe</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Environment
                  <select
                    value={billingApiForm.environment}
                    onChange={(event) =>
                      setBillingApiForm((currentForm) => ({
                        ...currentForm,
                        environment: event.target.value as BillingApiForm['environment'],
                      }))
                    }
                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  >
                    <option value="sandbox">Sandbox</option>
                    <option value="live">Live</option>
                  </select>
                </label>
              </div>
              <input value={billingApiForm.paypalClientId} onChange={(event) => setBillingApiForm((currentForm) => ({ ...currentForm, paypalClientId: event.target.value }))} placeholder="PayPal client ID" className="w-full rounded border px-3 py-2 text-sm" />
              <input value={billingApiForm.paypalClientSecret} onChange={(event) => setBillingApiForm((currentForm) => ({ ...currentForm, paypalClientSecret: event.target.value }))} placeholder="PayPal client secret" className="w-full rounded border px-3 py-2 text-sm" />
              <input value={billingApiForm.stripePublishableKey} onChange={(event) => setBillingApiForm((currentForm) => ({ ...currentForm, stripePublishableKey: event.target.value }))} placeholder="Stripe publishable key" className="w-full rounded border px-3 py-2 text-sm" />
              <input value={billingApiForm.stripeSecretKey} onChange={(event) => setBillingApiForm((currentForm) => ({ ...currentForm, stripeSecretKey: event.target.value }))} placeholder="Stripe secret key" className="w-full rounded border px-3 py-2 text-sm" />
              <input value={billingApiForm.webhookSecret} onChange={(event) => setBillingApiForm((currentForm) => ({ ...currentForm, webhookSecret: event.target.value }))} placeholder="Webhook secret" className="w-full rounded border px-3 py-2 text-sm" />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void saveManagedSetting(BILLING_API_SETTINGS_KEY, billingApiForm)}
                  disabled={saving[BILLING_API_SETTINGS_KEY] || loading}
                  className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving[BILLING_API_SETTINGS_KEY] ? 'Saving…' : 'Save billing API'}
                </button>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border border-gray-200 p-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Shipping</h3>
                <p className="text-xs text-gray-500">Keep carrier and fulfillment API details with store settings.</p>
              </div>
              <label className="block text-sm font-medium text-gray-700">
                Provider
                <select
                  value={shippingApiForm.provider}
                  onChange={(event) =>
                    setShippingApiForm((currentForm) => ({
                      ...currentForm,
                      provider: event.target.value as ShippingApiForm['provider'],
                    }))
                  }
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                >
                  <option value="manual">Manual</option>
                  <option value="shipstation">ShipStation</option>
                  <option value="shippo">Shippo</option>
                  <option value="easypost">EasyPost</option>
                </select>
              </label>
              <input value={shippingApiForm.apiKey} onChange={(event) => setShippingApiForm((currentForm) => ({ ...currentForm, apiKey: event.target.value }))} placeholder="API key" className="w-full rounded border px-3 py-2 text-sm" />
              <input value={shippingApiForm.apiSecret} onChange={(event) => setShippingApiForm((currentForm) => ({ ...currentForm, apiSecret: event.target.value }))} placeholder="API secret" className="w-full rounded border px-3 py-2 text-sm" />
              <input value={shippingApiForm.accountId} onChange={(event) => setShippingApiForm((currentForm) => ({ ...currentForm, accountId: event.target.value }))} placeholder="Account ID" className="w-full rounded border px-3 py-2 text-sm" />
              <div className="grid gap-4 md:grid-cols-2">
                <input value={shippingApiForm.originPostalCode} onChange={(event) => setShippingApiForm((currentForm) => ({ ...currentForm, originPostalCode: event.target.value }))} placeholder="Origin ZIP/postal code" className="w-full rounded border px-3 py-2 text-sm" />
                <input value={shippingApiForm.originCountry} onChange={(event) => setShippingApiForm((currentForm) => ({ ...currentForm, originCountry: event.target.value }))} placeholder="Origin country" className="w-full rounded border px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void saveManagedSetting(SHIPPING_API_SETTINGS_KEY, shippingApiForm)}
                  disabled={saving[SHIPPING_API_SETTINGS_KEY] || loading}
                  className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving[SHIPPING_API_SETTINGS_KEY] ? 'Saving…' : 'Save shipping API'}
                </button>
              </div>
            </div>
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
              <label htmlFor="show-homepage-pages-section" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  id="show-homepage-pages-section"
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
              <label htmlFor="show-homepage-posts-section" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  id="show-homepage-posts-section"
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

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-900">Blog sidebar widgets</h3>
            <p className="mt-1 text-sm text-gray-500">Choose which widgets appear in the blog sidebar and rename their headings.</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {(['search', 'categories', 'tags', 'authors', 'archives'] as Array<keyof SiteThemeForm['blogSidebar']>).map((key) => (
                <div key={key} className="rounded-lg border border-gray-200 p-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={themeForm.blogSidebar[key].enabled}
                      onChange={(event) =>
                        setThemeForm((currentForm) => ({
                          ...currentForm,
                          blogSidebar: {
                            ...currentForm.blogSidebar,
                            [key]: {
                              ...currentForm.blogSidebar[key],
                              enabled: event.target.checked,
                            },
                          },
                        }))
                      }
                    />
                    Show {key}
                  </label>
                  <input
                    value={themeForm.blogSidebar[key].title}
                    onChange={(event) =>
                      setThemeForm((currentForm) => ({
                        ...currentForm,
                        blogSidebar: {
                          ...currentForm.blogSidebar,
                          [key]: {
                            ...currentForm.blogSidebar[key],
                            title: event.target.value,
                          },
                        },
                      }))
                    }
                    className="mt-3 w-full rounded border px-3 py-2 text-sm"
                    placeholder={`${key} title`}
                  />
                </div>
              ))}
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
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Homepage blocks</h2>
            <p className="text-sm text-gray-500">
              The public landing page now renders reusable blocks from the <code className="font-mono text-xs">{SITE_HOMEPAGE_BLOCKS_KEY}</code> setting.
              Use reset to reapply a safe starter block layout.
            </p>
          </div>

          <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-600">
            <p>
              Starter blocks include featured pages, latest posts, and an optional CTA block. Advanced users can fine-tune the JSON value in <strong>All settings</strong>.
            </p>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => void saveManagedSetting(SITE_HOMEPAGE_BLOCKS_KEY, defaultHomepageBlocks)}
              disabled={saving[SITE_HOMEPAGE_BLOCKS_KEY] || loading}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving[SITE_HOMEPAGE_BLOCKS_KEY] ? 'Saving…' : 'Reset starter blocks'}
            </button>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Extension points</h2>
            <p className="text-sm text-gray-500">
              Keep lightweight integration hooks under <code className="font-mono text-xs">{SITE_EXTENSION_POINTS_KEY}</code> (for example, extra menu links injected by future modules).
            </p>
          </div>

          <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-600">
            <p>
              This remains intentionally lightweight: no third-party marketplace, but a stable seam for integration-friendly customizations.
            </p>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => void saveManagedSetting(SITE_EXTENSION_POINTS_KEY, DEFAULT_SITE_EXTENSION_POINTS)}
              disabled={saving[SITE_EXTENSION_POINTS_KEY] || loading}
              className="rounded border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {saving[SITE_EXTENSION_POINTS_KEY] ? 'Saving…' : 'Reset extension points'}
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

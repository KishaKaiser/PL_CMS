'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface GoogleMerchantSettings {
  enabled: boolean;
  siteUrl: string;
  storeName: string;
  defaultBrand: string;
  defaultGoogleCategory: string;
  defaultCondition: string;
  productUrlPattern: string;
}

const defaultSettings: GoogleMerchantSettings = {
  enabled: true,
  siteUrl: '',
  storeName: 'Psychic Link Store',
  defaultBrand: 'The Psychic Link',
  defaultGoogleCategory: 'Religious & Ceremonial > Spiritual & Esoteric Items',
  defaultCondition: 'new',
  productUrlPattern: '/shop/{{id}}',
};

export default function AdminGoogleMerchantPage() {
  const [settings, setSettings] = useState<GoogleMerchantSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const feedUrl = useMemo(() => {
    const base = settings.siteUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    return `${base.replace(/\/+$/, '')}/api/proxy/store/google-merchant/feed.xml`;
  }, [settings.siteUrl]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/proxy/store/admin/google-merchant');
      if (!res.ok) throw new Error('Could not load Google Merchant settings.');
      setSettings({ ...defaultSettings, ...((await res.json()) as GoogleMerchantSettings) });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load Google Merchant settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function saveSettings() {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/proxy/store/admin/google-merchant', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? 'Could not save Google Merchant settings.');
      }
      setSettings({ ...defaultSettings, ...((await res.json()) as GoogleMerchantSettings) });
      setMessage('Google Merchant settings saved.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save Google Merchant settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Google Merchant Center</h1>
        <p className="mt-1 text-sm text-gray-600">Manage the product feed used by Google Merchant Center.</p>
      </div>

      {error && <p className="mb-4 rounded bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {message && <p className="mb-4 rounded bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}

      {loading ? (
        <p className="text-gray-500">Loading Google Merchant settings...</p>
      ) : (
        <div className="space-y-6">
          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))}
                />
                Enable Google Merchant feed
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Site URL
                <input
                  value={settings.siteUrl}
                  onChange={(event) => setSettings((current) => ({ ...current, siteUrl: event.target.value }))}
                  placeholder="https://your-site.com"
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Store Name
                <input
                  value={settings.storeName}
                  onChange={(event) => setSettings((current) => ({ ...current, storeName: event.target.value }))}
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Default Brand
                <input
                  value={settings.defaultBrand}
                  onChange={(event) => setSettings((current) => ({ ...current, defaultBrand: event.target.value }))}
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Product URL Pattern
                <input
                  value={settings.productUrlPattern}
                  onChange={(event) => setSettings((current) => ({ ...current, productUrlPattern: event.target.value }))}
                  className="mt-1 w-full rounded border px-3 py-2 font-mono text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Default Condition
                <select
                  value={settings.defaultCondition}
                  onChange={(event) => setSettings((current) => ({ ...current, defaultCondition: event.target.value }))}
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                >
                  <option value="new">New</option>
                  <option value="refurbished">Refurbished</option>
                  <option value="used">Used</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700 md:col-span-2">
                Default Google Product Category
                <input
                  value={settings.defaultGoogleCategory}
                  onChange={(event) => setSettings((current) => ({ ...current, defaultGoogleCategory: event.target.value }))}
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveSettings()}
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Product Feed URL</h2>
            <p className="mt-2 break-all rounded bg-gray-50 p-3 font-mono text-sm text-gray-700">{feedUrl}</p>
            <a href="/api/proxy/store/google-merchant/feed.xml" target="_blank" className="mt-4 inline-flex rounded border px-4 py-2 text-sm font-medium hover:bg-gray-50">
              Preview Feed
            </a>
          </section>
        </div>
      )}
    </main>
  );
}

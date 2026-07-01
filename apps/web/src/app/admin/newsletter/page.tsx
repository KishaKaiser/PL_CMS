'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface NewsletterSettings {
  enabled: boolean;
  defaultTitle: string;
  defaultDescription: string;
  defaultButtonLabel: string;
  defaultPlaceholder: string;
  collectName: boolean;
  successMessage: string;
  welcomeSubject: string;
  welcomeBody: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  consentText: string;
  gdprNotice: string;
  retentionPolicy: string;
}

interface Subscriber {
  email: string;
  name: string;
  source: string;
  status: 'SUBSCRIBED' | 'UNSUBSCRIBED';
  subscribedAt: string;
  unsubscribedAt?: string;
  privacyConsent?: boolean;
  termsConsent?: boolean;
  consentedAt?: string;
}

const defaultSettings: NewsletterSettings = {
  enabled: true,
  defaultTitle: 'Join Our Newsletter',
  defaultDescription: 'Get updates and offers in your inbox.',
  defaultButtonLabel: 'Subscribe',
  defaultPlaceholder: 'Email address',
  collectName: false,
  successMessage: 'Thank you for subscribing.',
  welcomeSubject: 'Welcome to our newsletter',
  welcomeBody: 'Thank you for subscribing. We are glad you are here.',
  privacyPolicyUrl: '/privacy-policy',
  termsUrl: '/terms',
  consentText: 'I agree to the privacy policy and terms and conditions.',
  gdprNotice: 'You can unsubscribe at any time. We store your email only for newsletter communication.',
  retentionPolicy: 'Newsletter subscriber records are kept until unsubscribe or deletion is requested.',
};

export default function AdminNewsletterPage() {
  const [settings, setSettings] = useState<NewsletterSettings>(defaultSettings);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const filteredSubscribers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return subscribers;
    return subscribers.filter((subscriber) =>
      [subscriber.email, subscriber.name, subscriber.source, subscriber.status].some((value) =>
        value.toLowerCase().includes(normalized),
      ),
    );
  }, [query, subscribers]);

  const fetchNewsletter = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [settingsRes, subscribersRes] = await Promise.all([
        fetch('/api/proxy/newsletter/admin/settings'),
        fetch('/api/proxy/newsletter/admin/subscribers'),
      ]);
      if (!settingsRes.ok || !subscribersRes.ok) throw new Error('Could not load newsletter module.');
      setSettings({ ...defaultSettings, ...((await settingsRes.json()) as NewsletterSettings) });
      setSubscribers((await subscribersRes.json()) as Subscriber[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load newsletter module.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNewsletter();
  }, [fetchNewsletter]);

  async function saveSettings() {
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/proxy/newsletter/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? 'Could not save newsletter settings.');
      }
      setSettings((await res.json()) as NewsletterSettings);
      setMessage('Newsletter settings saved.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save newsletter settings.');
    }
  }

  async function unsubscribe(email: string) {
    await subscriberAction(`/api/proxy/newsletter/admin/subscribers/${encodeURIComponent(email)}/unsubscribe`, 'POST', 'Subscriber unsubscribed.');
  }

  async function deleteSubscriber(email: string) {
    await subscriberAction(`/api/proxy/newsletter/admin/subscribers/${encodeURIComponent(email)}`, 'DELETE', 'Subscriber deleted.');
  }

  async function subscriberAction(url: string, method: string, success: string) {
    setMessage('');
    setError('');
    try {
      const res = await fetch(url, { method });
      if (!res.ok) throw new Error('Subscriber update failed.');
      setMessage(success);
      await fetchNewsletter();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Subscriber update failed.');
    }
  }

  async function exportSubscribers() {
    setError('');
    try {
      const res = await fetch('/api/proxy/newsletter/admin/export');
      if (!res.ok) throw new Error('Export failed.');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    }
  }

  return (
    <main className="mx-auto max-w-7xl p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Newsletter</h1>
          <p className="mt-1 text-sm text-gray-600">Manage newsletter defaults, subscribers, and exports.</p>
        </div>
        <button type="button" onClick={() => void exportSubscribers()} className="rounded border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
          Export Subscribers
        </button>
      </div>

      {error && <p className="mb-4 rounded bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {message && <p className="mb-4 rounded bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}

      {loading ? <p className="text-gray-500">Loading newsletter...</p> : (
        <div className="space-y-8">
          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Module Settings</h2>
              <p className="text-sm text-gray-500">These defaults are used by newsletter widgets unless a widget overrides them.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
                <input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))} />
                Enable newsletter signup
              </label>
              <label className="block text-sm font-medium text-gray-700">Default Title<input value={settings.defaultTitle} onChange={(event) => setSettings((current) => ({ ...current, defaultTitle: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
              <label className="block text-sm font-medium text-gray-700">Button Label<input value={settings.defaultButtonLabel} onChange={(event) => setSettings((current) => ({ ...current, defaultButtonLabel: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
              <label className="block text-sm font-medium text-gray-700 md:col-span-2">Default Description<textarea value={settings.defaultDescription} rows={3} onChange={(event) => setSettings((current) => ({ ...current, defaultDescription: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
              <label className="block text-sm font-medium text-gray-700">Email Placeholder<input value={settings.defaultPlaceholder} onChange={(event) => setSettings((current) => ({ ...current, defaultPlaceholder: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
              <label className="block text-sm font-medium text-gray-700">Success Message<input value={settings.successMessage} onChange={(event) => setSettings((current) => ({ ...current, successMessage: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
              <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
                <input type="checkbox" checked={settings.collectName} onChange={(event) => setSettings((current) => ({ ...current, collectName: event.target.checked }))} />
                Ask for name by default
              </label>
              <label className="block text-sm font-medium text-gray-700">Welcome Email Subject<input value={settings.welcomeSubject} onChange={(event) => setSettings((current) => ({ ...current, welcomeSubject: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
              <label className="block text-sm font-medium text-gray-700 md:col-span-2">Welcome Email Body<textarea value={settings.welcomeBody} rows={4} onChange={(event) => setSettings((current) => ({ ...current, welcomeBody: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
              <label className="block text-sm font-medium text-gray-700">Privacy Policy URL<input value={settings.privacyPolicyUrl} onChange={(event) => setSettings((current) => ({ ...current, privacyPolicyUrl: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
              <label className="block text-sm font-medium text-gray-700">Terms URL<input value={settings.termsUrl} onChange={(event) => setSettings((current) => ({ ...current, termsUrl: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
              <label className="block text-sm font-medium text-gray-700 md:col-span-2">Consent Checkbox Text<textarea value={settings.consentText} rows={2} onChange={(event) => setSettings((current) => ({ ...current, consentText: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
              <label className="block text-sm font-medium text-gray-700 md:col-span-2">GDPR Notice<textarea value={settings.gdprNotice} rows={3} onChange={(event) => setSettings((current) => ({ ...current, gdprNotice: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
              <label className="block text-sm font-medium text-gray-700 md:col-span-2">Retention Policy<textarea value={settings.retentionPolicy} rows={3} onChange={(event) => setSettings((current) => ({ ...current, retentionPolicy: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
            </div>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => void saveSettings()} className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">Save Newsletter Settings</button>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Subscribers</h2>
                <p className="text-sm text-gray-500">{subscribers.length} total subscribers</p>
              </div>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search subscribers" className="rounded border px-3 py-2 text-sm" />
            </div>
            <div className="overflow-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Consent</th>
                    <th className="px-3 py-2">Subscribed</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubscribers.map((subscriber) => (
                    <tr key={subscriber.email} className="border-t">
                      <td className="px-3 py-2 font-medium">{subscriber.email}</td>
                      <td className="px-3 py-2">{subscriber.name || '-'}</td>
                      <td className="px-3 py-2">{subscriber.source}</td>
                      <td className="px-3 py-2">{subscriber.status}</td>
                      <td className="px-3 py-2">{subscriber.privacyConsent && subscriber.termsConsent ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2">{new Date(subscriber.subscribedAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2 text-right">
                        {subscriber.status !== 'UNSUBSCRIBED' && (
                          <button type="button" onClick={() => void unsubscribe(subscriber.email)} className="mr-3 text-indigo-600 hover:underline">Unsubscribe</button>
                        )}
                        <button type="button" onClick={() => void deleteSubscriber(subscriber.email)} className="text-red-600 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {filteredSubscribers.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">No subscribers found.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

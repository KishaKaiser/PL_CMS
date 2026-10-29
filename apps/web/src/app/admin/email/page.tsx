'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { EmailDesignSection } from '../../../components/admin/email-design-section';

interface EmailSettingsView {
  provider: 'icloud' | 'custom';
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromName: string;
  fromAddress: string;
  notifyAddress: string;
  siteUrl: string;
  notifyOnOrders: boolean;
  notifyOnForms: boolean;
  accentColor: string;
  showLogo: boolean;
  showSiteName: boolean;
  trackButtonLabel: string;
  signature: string;
  footerText: string;
  passwordSet: boolean;
}

interface EmailState {
  settings: EmailSettingsView;
  working: 'settings' | 'environment' | null;
  siteUrl: string;
}

interface EmailLogEntry {
  id: string;
  to: string;
  subject: string;
  kind: string;
  status: 'SENT' | 'FAILED';
  error: string | null;
  createdAt: string;
}

const inputClass = 'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm';

const KIND_LABELS: Record<string, string> = {
  test: 'Test',
  'order-confirmation': 'Order confirmation',
  'order-alert': 'New order alert',
  'order-progress': 'Order update',
  'order-shipped': 'Order shipped',
  'form-alert': 'Form alert',
  'newsletter-welcome': 'Newsletter welcome',
  general: 'Other',
};

/**
 * Connects the site to the mail account it sends from (iCloud Mail, with an app-specific password), sends a test email, and
 * shows what has been sent and why one failed.
 */
export default function AdminEmailPage() {
  const [state, setState] = useState<EmailState | null>(null);
  const [form, setForm] = useState<EmailSettingsView | null>(null);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [log, setLog] = useState<EmailLogEntry[]>([]);

  const loadLog = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/admin/email-settings/log');
      if (res.ok) setLog((await res.json()) as EmailLogEntry[]);
    } catch {
      /* the log is a nicety */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/admin/email-settings');
      if (!res.ok) throw new Error('Could not load the email settings');
      const next = (await res.json()) as EmailState;
      setState(next);
      setForm({ ...next.settings, siteUrl: next.settings.siteUrl || (typeof window !== 'undefined' ? window.location.origin : '') });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load the email settings');
    }
    await loadLog();
  }, [loadLog]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!form || !state) {
    return <div className="p-8 text-sm text-gray-500">{error || 'Loading...'}</div>;
  }

  const icloud = form.provider === 'icloud';

  function update<K extends keyof EmailSettingsView>(field: K, value: EmailSettingsView[K]) {
    setForm((current) => (current ? { ...current, [field]: value } : current));
    setMessage('');
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/proxy/admin/email-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: form.provider,
          ...(form.provider === 'custom' ? { host: form.host, port: Number(form.port) || 587, secure: form.secure } : {}),
          username: form.username,
          ...(password.trim() ? { password: password.trim() } : {}),
          fromName: form.fromName,
          fromAddress: form.fromAddress,
          notifyAddress: form.notifyAddress,
          siteUrl: form.siteUrl,
          notifyOnOrders: form.notifyOnOrders,
          notifyOnForms: form.notifyOnForms,
          accentColor: form.accentColor,
          showLogo: form.showLogo,
          showSiteName: form.showSiteName,
          trackButtonLabel: form.trackButtonLabel,
          signature: form.signature,
          footerText: form.footerText,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        throw new Error(Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? 'Could not save the email settings'));
      }
      const saved = (await res.json()) as EmailState;
      setState(saved);
      // The form keeps what was typed, but now knows whether a password is saved (it is never sent back).
      setForm((current) => (current ? { ...current, passwordSet: saved.settings.passwordSet } : current));
      setPassword('');
      setMessage('Saved. Now send a test email to check that it works.');
      if (!testTo) setTestTo(form.notifyAddress || form.fromAddress || form.username);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save the email settings');
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!form) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/proxy/admin/email-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testTo || form.notifyAddress || form.fromAddress || form.username }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string | string[] };
      const text = Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? '');
      setTestResult(res.ok ? { ok: Boolean(body.ok), message: text } : { ok: false, message: text || 'The test could not be sent.' });
    } catch {
      setTestResult({ ok: false, message: 'The test could not be sent.' });
    } finally {
      setTesting(false);
      await loadLog();
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">Email</h1>
        {state.working === 'settings' && <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">Set up</span>}
        {state.working === 'environment' && (
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">Using the server&apos;s mail settings</span>
        )}
        {state.working === null && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Not set up yet</span>}
      </div>
      <p className="mb-6 max-w-2xl text-sm text-gray-600">
        Connect the mail account the site sends from. Customers then get order emails, and you get alerts. Your password is stored
        encrypted and is never shown again.
      </p>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{icloud ? 'Connect your iCloud Mail' : 'Connect a mail account'}</h2>

        {icloud && (
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-gray-600">
            <li>
              Go to <strong>appleid.apple.com</strong> and sign in. Open <strong>Sign-In and Security → App-Specific Passwords</strong>.
            </li>
            <li>
              Click <strong>Generate</strong>, name it &ldquo;Website&rdquo;, and copy the password it shows (it looks like
              abcd-efgh-ijkl-mnop). Your Apple ID needs two-factor authentication turned on.
            </li>
            <li>Paste it below with your iCloud email address, and save. Use this app-specific password, not your Apple ID password.</li>
          </ol>
        )}

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700">
            Mail service
            <select value={form.provider} onChange={(event) => update('provider', event.target.value as 'icloud' | 'custom')} className={inputClass}>
              <option value="icloud">iCloud Mail</option>
              <option value="custom">Another mail service (advanced)</option>
            </select>
          </label>
          <div />

          {!icloud && (
            <>
              <label className="block text-sm font-medium text-gray-700">
                Server name
                <input value={form.host} onChange={(event) => update('host', event.target.value)} placeholder="smtp.example.com" className={inputClass} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-gray-700">
                  Port
                  <input type="number" value={form.port} onChange={(event) => update('port', Number(event.target.value))} className={inputClass} />
                </label>
                <label className="mt-7 flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={form.secure} onChange={(event) => update('secure', event.target.checked)} />
                  Secure from the start (port 465)
                </label>
              </div>
            </>
          )}

          <label className="block text-sm font-medium text-gray-700">
            {icloud ? 'iCloud email address' : 'Username'}
            <input
              value={form.username}
              onChange={(event) => update('username', event.target.value)}
              placeholder={icloud ? 'yourname@icloud.com' : ''}
              autoComplete="off"
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            {icloud ? 'App-specific password' : 'Password'}
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={form.passwordSet ? 'A password is saved. Type a new one to replace it.' : 'abcd-efgh-ijkl-mnop'}
              autoComplete="new-password"
              className={inputClass}
            />
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Name emails come from
            <input value={form.fromName} onChange={(event) => update('fromName', event.target.value)} placeholder="The Psychic Link" className={inputClass} />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            From address
            <input value={form.fromAddress} onChange={(event) => update('fromAddress', event.target.value)} placeholder={form.username || 'yourname@icloud.com'} className={inputClass} />
            <span className="mt-1 block text-xs font-normal text-gray-500">
              {icloud ? 'Leave empty to use your iCloud address. iCloud only sends from that address or one of its aliases.' : 'Leave empty to use the username.'}
            </span>
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Send alerts to
            <input value={form.notifyAddress} onChange={(event) => update('notifyAddress', event.target.value)} placeholder={form.fromAddress || form.username || 'you@example.com'} className={inputClass} />
            <span className="mt-1 block text-xs font-normal text-gray-500">Where new order and form alerts go. Leave empty to use the from address.</span>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Your site address
            <input value={form.siteUrl} onChange={(event) => update('siteUrl', event.target.value)} placeholder="https://psychiclink.link" className={inputClass} />
            <span className="mt-1 block text-xs font-normal text-gray-500">Used for the links in emails, such as &ldquo;Track your order&rdquo;.</span>
          </label>
        </div>

        <div className="mt-5 space-y-2 text-sm text-gray-700">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.notifyOnOrders} onChange={(event) => update('notifyOnOrders', event.target.checked)} />
            Email me when someone places an order
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.notifyOnForms} onChange={(event) => update('notifyOnForms', event.target.checked)} />
            Email me when someone submits a form
          </label>
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {message && (
          <p role="status" className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
            {message}
          </p>
        )}
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="mt-5 rounded bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </section>

      <EmailDesignSection
        design={{
          accentColor: form.accentColor,
          showLogo: form.showLogo,
          showSiteName: form.showSiteName,
          trackButtonLabel: form.trackButtonLabel,
          signature: form.signature,
          footerText: form.footerText,
        }}
        onChange={(patch) => {
          setForm((current) => (current ? { ...current, ...patch } : current));
          setMessage('');
        }}
      />

      <section className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Send a test email</h2>
        <p className="text-sm text-gray-500">Checks the password and sends a short message. Save your changes first.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block min-w-[16rem] flex-1 text-sm font-medium text-gray-700">
            Send it to
            <input value={testTo} onChange={(event) => setTestTo(event.target.value)} placeholder={form.notifyAddress || form.fromAddress || form.username || 'you@example.com'} className={inputClass} />
          </label>
          <button
            type="button"
            onClick={() => void sendTest()}
            disabled={testing}
            className="rounded border border-indigo-300 px-5 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
          >
            {testing ? 'Sending...' : 'Send test email'}
          </button>
        </div>
        {testResult && (
          <p role="status" className={`mt-4 rounded-lg px-4 py-3 text-sm ${testResult.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
            {testResult.message}
          </p>
        )}
      </section>

      <section className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Emails the site sends</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li>To customers: order confirmation, order updates (being made, being packaged, ready to ship) and order shipped, and the newsletter welcome.</li>
          <li>To you: a new order alert, form submissions, and advisor application and onboarding notices.</li>
        </ul>
        <p className="mt-3 text-sm text-gray-600">
          Change the wording of the order emails in{' '}
          <Link href="/admin/store" className="text-indigo-600 hover:underline">
            Store settings → Emails
          </Link>
          , and the newsletter welcome in Newsletter settings.
        </p>
        <p className="mt-3 rounded bg-gray-50 px-3 py-2 text-xs text-gray-600">
          iCloud limits how many emails an account can send in a day (roughly 1,000). That is plenty for orders and alerts, but not for large mailings.
        </p>
      </section>

      <section className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent emails</h2>
          <button type="button" onClick={() => void loadLog()} className="text-sm text-indigo-600 hover:underline">
            Refresh
          </button>
        </div>
        {log.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">Nothing has been sent yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">What</th>
                  <th className="py-2 pr-3">To</th>
                  <th className="py-2">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {log.map((entry) => (
                  <tr key={entry.id} className="align-top">
                    <td className="whitespace-nowrap py-2 pr-3 text-gray-500">{new Date(entry.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-3">
                      <span className="font-medium">{KIND_LABELS[entry.kind] ?? entry.kind}</span>
                      <span className="block text-xs text-gray-500">{entry.subject}</span>
                    </td>
                    <td className="break-all py-2 pr-3">{entry.to}</td>
                    <td className="py-2">
                      {entry.status === 'SENT' ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Sent</span>
                      ) : (
                        <>
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Failed</span>
                          {entry.error && <span className="mt-1 block text-xs text-red-700">{entry.error}</span>}
                        </>
                      )}
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

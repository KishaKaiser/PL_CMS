'use client';

import { useEffect, useState } from 'react';

const SETTING_KEY = 'shipstation_tracking_api_key';

/**
 * The key that lets the tracking page show the carrier's updates (in transit, delivered...) through ShipStation. Without it the
 * page still shows the order's steps, the tracking number and a link to the carrier's own tracking page.
 */
export function ShipStationTrackingKeyCard() {
  const [saved, setSaved] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/proxy/settings/${SETTING_KEY}`)
      .then(async (res) => {
        if (!res.ok) return;
        const text = await res.text();
        if (!text) return;
        const body = JSON.parse(text) as { value?: string } | null;
        setSaved(Boolean(body?.value?.trim()));
      })
      .catch(() => undefined);
  }, []);

  async function save(next: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/proxy/settings/${SETTING_KEY}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: next.trim() }),
      });
      if (!res.ok) throw new Error('Could not save the tracking key');
      setSaved(Boolean(next.trim()));
      setValue('');
      setMessage(next.trim() ? 'Tracking key saved.' : 'Tracking key removed.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save the tracking key');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-lg border bg-white p-5 text-sm shadow-sm">
      <h2 className="text-lg font-semibold">Order tracking</h2>
      <p className="mt-1 text-gray-500">
        Customers see their order&apos;s steps and tracking number on their tracking page. To also show the carrier&apos;s delivery updates there
        (in transit, out for delivery, delivered) and mark orders delivered automatically, add your ShipStation <strong>API v2 key</strong> from
        ShipStation → Account → API Settings. ShipStation&apos;s tracking is included with its Advanced plan and above. This is a different key
        from the API key and secret above.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block min-w-[16rem] flex-1 text-xs font-medium text-gray-600">
          ShipStation tracking (API v2) key
          <input
            type="password"
            autoComplete="off"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={saved ? 'A key is saved. Type a new one to replace it.' : 'Paste the key'}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={busy || !value.trim()}
          onClick={() => void save(value)}
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Save key
        </button>
        {saved && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void save('')}
            className="rounded border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Remove key
          </button>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {message && (
        <p role="status" className="mt-3 text-sm text-green-700">
          {message}
        </p>
      )}
    </section>
  );
}

'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

interface Promo {
  enabled: boolean;
  minutes: number;
  expiresInDays: number | null;
}

interface Overview {
  totals: { source: string; grants: number; minutesGiven: number; minutesLeft: number }[];
  promoClients: number;
  recent: { id: string; source: string; minutes: number; remaining: number; note: string | null; expiresAt: string | null; createdAt: string; to: string }[];
}

interface ClientOption {
  id: string;
  name: string;
  role: string;
}

const SOURCE_LABEL: Record<string, string> = { ADVISOR: 'From advisors', ADMIN: 'From admin', PROMO: 'Welcome promotion' };

async function readMessage(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
  if (Array.isArray(data.message)) return data.message.join(' ');
  return data.message ?? fallback;
}

export default function AdminFreeMinutesPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [promo, setPromo] = useState<Promo>({ enabled: false, minutes: 5, expiresInDays: 30 });
  const [promoNeverExpires, setPromoNeverExpires] = useState(false);
  const [send, setSend] = useState({ audience: 'CLIENT' as 'CLIENT' | 'ALL_CLIENTS', clientUserId: '', minutes: '10', expiresInDays: '30', note: '' });
  const [neverExpires, setNeverExpires] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const [overviewRes, promoRes, contactsRes] = await Promise.all([
        fetch('/api/proxy/admin/free-minutes'),
        fetch('/api/proxy/admin/free-minutes/promo'),
        fetch('/api/proxy/messages/contacts'),
      ]);
      if (overviewRes.ok) setOverview((await overviewRes.json()) as Overview);
      if (promoRes.ok) {
        const loaded = (await promoRes.json()) as Promo;
        setPromo(loaded);
        setPromoNeverExpires(loaded.expiresInDays === null);
      }
      if (contactsRes.ok) setClients(((await contactsRes.json()) as ClientOption[]).filter((c) => c.role === 'CLIENT'));
    } catch {
      setError('Unable to load free minutes');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(path: string, method: string, body: unknown, done: (result: unknown) => string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/proxy/admin/free-minutes${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readMessage(res, 'That did not work'));
      setMessage(done(await res.json()));
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'That did not work');
    } finally {
      setBusy(false);
    }
  }

  function sendMinutes(event: FormEvent) {
    event.preventDefault();
    const minutes = Number(send.minutes);
    if (send.audience === 'ALL_CLIENTS' && !window.confirm(`Give ${minutes} free minutes to every client?`)) return;
    void submit(
      '/send',
      'POST',
      {
        audience: send.audience,
        ...(send.audience === 'CLIENT' ? { clientUserId: send.clientUserId } : {}),
        minutes,
        ...(neverExpires ? {} : { expiresInDays: Number(send.expiresInDays) }),
        ...(send.note.trim() ? { note: send.note.trim() } : {}),
      },
      (result) => {
        const { clients: count } = result as { clients: number };
        return `Sent ${minutes} free minutes to ${count} client${count === 1 ? '' : 's'}.`;
      },
    );
  }

  function savePromo(event: FormEvent) {
    event.preventDefault();
    void submit(
      '/promo',
      'PUT',
      { enabled: promo.enabled, minutes: promo.minutes, ...(promoNeverExpires ? {} : { expiresInDays: promo.expiresInDays ?? 30 }) },
      () => (promo.enabled ? 'The welcome promotion is on.' : 'The welcome promotion is off.'),
    );
  }

  const field = 'mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm';

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold">Free minutes</h1>
        <p className="mt-1 text-sm text-gray-600">
          Free minutes are used before a client&apos;s wallet is charged. They work with any advisor, take nothing from the wallet and
          create no revenue. Advisors can also gift 1, 3 or 5 minutes that work only with them.
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {message && <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}

      <section className="rounded-lg border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Welcome promotion for new clients</h2>
        <p className="mt-1 text-sm text-gray-600">
          When on, every client who signs up from now on gets these minutes automatically. Existing clients are not affected;
          use &quot;Send free minutes&quot; below for them.
          {overview ? ` ${overview.promoClients} client${overview.promoClients === 1 ? '' : 's'} so far.` : ''}
        </p>
        <form onSubmit={savePromo} className="mt-4 space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
            <input type="checkbox" checked={promo.enabled} onChange={(event) => setPromo({ ...promo, enabled: event.target.checked })} />
            Give new clients free minutes
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-gray-700">
              Free minutes
              <input type="number" min={1} max={600} value={promo.minutes} onChange={(event) => setPromo({ ...promo, minutes: Number(event.target.value) })} className={field} />
            </label>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Days they last
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={promo.expiresInDays ?? 30}
                  disabled={promoNeverExpires}
                  onChange={(event) => setPromo({ ...promo, expiresInDays: Number(event.target.value) })}
                  className={`${field} disabled:bg-gray-100`}
                />
              </label>
              <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={promoNeverExpires} onChange={(event) => setPromoNeverExpires(event.target.checked)} />
                Never expire
              </label>
            </div>
          </div>
          <button type="submit" disabled={busy} className="rounded bg-purple-700 px-5 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50">
            Save promotion
          </button>
        </form>
      </section>

      <section className="rounded-lg border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Send free minutes</h2>
        <form onSubmit={sendMinutes} className="mt-4 space-y-4">
          <fieldset className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" checked={send.audience === 'CLIENT'} onChange={() => setSend({ ...send, audience: 'CLIENT' })} />
              One client
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={send.audience === 'ALL_CLIENTS'} onChange={() => setSend({ ...send, audience: 'ALL_CLIENTS' })} />
              Every client
            </label>
          </fieldset>

          {send.audience === 'CLIENT' && (
            <label className="block text-sm font-medium text-gray-700">
              Client
              <select value={send.clientUserId} onChange={(event) => setSend({ ...send, clientUserId: event.target.value })} required className={field}>
                <option value="">Choose a client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-gray-700">
              Free minutes
              <input type="number" min={1} max={600} value={send.minutes} onChange={(event) => setSend({ ...send, minutes: event.target.value })} required className={field} />
            </label>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Days they last
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={send.expiresInDays}
                  disabled={neverExpires}
                  onChange={(event) => setSend({ ...send, expiresInDays: event.target.value })}
                  className={`${field} disabled:bg-gray-100`}
                />
              </label>
              <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={neverExpires} onChange={(event) => setNeverExpires(event.target.checked)} />
                Never expire
              </label>
            </div>
          </div>

          <label className="block text-sm font-medium text-gray-700">
            Note for the client (optional)
            <input value={send.note} onChange={(event) => setSend({ ...send, note: event.target.value })} maxLength={200} className={field} placeholder="Sorry about the dropped call" />
          </label>

          <p className="text-xs text-gray-500">The client also gets a message from Support telling them about it.</p>
          <button type="submit" disabled={busy || (send.audience === 'CLIENT' && !send.clientUserId)} className="rounded bg-purple-700 px-5 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50">
            {busy ? 'Sending...' : 'Send free minutes'}
          </button>
        </form>
      </section>

      {overview && (
        <section className="rounded-lg border bg-white shadow-sm">
          <div className="border-b px-5 py-3">
            <h2 className="text-lg font-semibold">What has been given</h2>
          </div>
          {overview.totals.length > 0 && (
            <dl className="grid gap-px border-b bg-gray-100 sm:grid-cols-3">
              {overview.totals.map((row) => (
                <div key={row.source} className="bg-white px-5 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{SOURCE_LABEL[row.source] ?? row.source}</dt>
                  <dd className="mt-1 text-sm text-gray-800">
                    {row.minutesGiven} minutes given · {row.minutesLeft} unused
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <ul className="divide-y">
            {overview.recent.map((row) => (
              <li key={row.id} className="flex flex-wrap justify-between gap-2 px-5 py-2.5 text-sm">
                <span>
                  {row.minutes} min to <span className="font-medium">{row.to}</span>
                  {row.note ? <span className="text-gray-500"> — {row.note}</span> : null}
                </span>
                <span className="text-gray-500">
                  {SOURCE_LABEL[row.source] ?? row.source} · {row.remaining === row.minutes ? 'unused' : `${row.remaining} left`} ·{' '}
                  {new Date(row.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
            {overview.recent.length === 0 && <li className="px-5 py-4 text-sm text-gray-500">Nothing given by admin or promotion yet.</li>}
          </ul>
        </section>
      )}
    </div>
  );
}

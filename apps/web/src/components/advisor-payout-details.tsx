'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

interface Method {
  id: string;
  label: string;
  methodType: string;
  accountName: string;
  isDefault: boolean;
  summary: string;
}

type MethodType = 'PAYPAL' | 'BANK' | 'OTHER';

const TYPE_LABEL: Record<string, string> = { PAYPAL: 'PayPal', BANK: 'Bank transfer', OTHER: 'Other' };

const empty = { type: 'PAYPAL' as MethodType, accountName: '', email: '', bankName: '', routingNumber: '', accountNumber: '', notes: '', isDefault: false };

async function readError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  if (Array.isArray(data?.message)) return data.message.join(' ');
  return data?.message ?? fallback;
}

/** How an advisor wants to be paid. Bank numbers are stored encrypted and never shown again in full. */
export function AdvisorPayoutDetails() {
  const [methods, setMethods] = useState<Method[]>([]);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/payouts/me/methods');
      if (res.ok) setMethods((await res.json()) as Method[]);
    } catch {
      // keep the last list
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const body: Record<string, unknown> = { type: form.type, accountName: form.accountName, isDefault: form.isDefault };
      if (form.type === 'PAYPAL') body.email = form.email;
      if (form.type === 'BANK') Object.assign(body, { bankName: form.bankName, routingNumber: form.routingNumber, accountNumber: form.accountNumber });
      if (form.type === 'OTHER') body.notes = form.notes;
      const res = await fetch('/api/proxy/payouts/me/methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readError(res, 'Unable to save your payout details'));
      setForm(empty);
      setNotice('Payout details saved.');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save your payout details');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Remove these payout details?')) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/proxy/payouts/me/methods/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readError(res, 'Unable to remove them'));
      setNotice('Payout details removed.');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to remove them');
    } finally {
      setBusy(false);
    }
  }

  const field = 'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm';
  const set = (key: keyof typeof empty) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        This is how Support will pay you what you have earned. Your default details are used for each payment. Bank numbers are stored
        encrypted, and only Support can see them in full.
      </p>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>}

      <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-gray-700">
          How should we pay you?
          <select value={form.type} onChange={(event) => setForm({ ...empty, type: event.target.value as MethodType, isDefault: form.isDefault })} className={field}>
            {(Object.keys(TYPE_LABEL) as MethodType[]).map((type) => (
              <option key={type} value={type}>
                {TYPE_LABEL[type]}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-gray-700">
          Name on the account
          <input value={form.accountName} onChange={set('accountName')} required maxLength={120} className={field} />
        </label>

        {form.type === 'PAYPAL' && (
          <label className="block text-sm font-medium text-gray-700 md:col-span-2">
            PayPal email address
            <input type="email" value={form.email} onChange={set('email')} required maxLength={254} className={field} />
          </label>
        )}

        {form.type === 'BANK' && (
          <>
            <label className="block text-sm font-medium text-gray-700 md:col-span-2">
              Bank name
              <input value={form.bankName} onChange={set('bankName')} required maxLength={120} className={field} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Routing number
              <input value={form.routingNumber} onChange={set('routingNumber')} required inputMode="numeric" autoComplete="off" maxLength={40} className={field} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Account number
              <input value={form.accountNumber} onChange={set('accountNumber')} required inputMode="numeric" autoComplete="off" maxLength={50} className={field} />
            </label>
          </>
        )}

        {form.type === 'OTHER' && (
          <label className="block text-sm font-medium text-gray-700 md:col-span-2">
            How would you like to be paid?
            <textarea value={form.notes} onChange={set('notes')} required rows={3} maxLength={500} className={field} />
          </label>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
          <input type="checkbox" checked={form.isDefault} onChange={(event) => setForm((current) => ({ ...current, isDefault: event.target.checked }))} />
          Use these as my default payout details
        </label>

        <div className="md:col-span-2">
          <button type="submit" disabled={busy} className="rounded-lg bg-purple-700 px-6 py-3 font-semibold text-white hover:bg-purple-800 disabled:opacity-50">
            {busy ? 'Saving...' : 'Save payout details'}
          </button>
        </div>
      </form>

      <ul className="divide-y rounded-xl border bg-white">
        {methods.map((method) => (
          <li key={method.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900">
                {TYPE_LABEL[method.methodType] ?? method.methodType}
                {method.isDefault && <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">Default</span>}
              </p>
              <p className="truncate text-sm text-gray-600">
                {method.accountName}
                {method.summary ? ` · ${method.summary}` : ''}
              </p>
            </div>
            <button type="button" onClick={() => void remove(method.id)} disabled={busy} className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">
              Remove
            </button>
          </li>
        ))}
        {methods.length === 0 && <li className="px-4 py-6 text-sm text-gray-500">No payout details saved yet. Add them so you can be paid.</li>}
      </ul>
    </div>
  );
}

'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

type Method = 'PAYPAL' | 'DIRECT_DEPOSIT';

interface Details {
  method: Method;
  paypalEmail: string | null;
  bankOnFile: boolean;
  bankInstructions: string | null;
  paypalFeePercent: number;
  directDepositFeePercent: number;
}

async function readError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  if (Array.isArray(data?.message)) return data.message.join(' ');
  return data?.message ?? fallback;
}

/**
 * How an advisor is paid: PayPal or Direct Deposit, changed whenever they like. Bank details are never entered on this
 * site; they are given to Support during onboarding, which is what makes Direct Deposit available.
 */
export function AdvisorPayoutDetails() {
  const [details, setDetails] = useState<Details | null>(null);
  const [method, setMethod] = useState<Method>('PAYPAL');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/payouts/me/details');
      if (!res.ok) throw new Error(await readError(res, 'Unable to load your payout details'));
      const loaded = (await res.json()) as Details;
      setDetails(loaded);
      setMethod(loaded.method);
      setEmail(loaded.paypalEmail ?? '');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load your payout details');
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
      const res = await fetch('/api/proxy/payouts/me/details', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, ...(email.trim() ? { paypalEmail: email.trim() } : {}) }),
      });
      if (!res.ok) throw new Error(await readError(res, 'Unable to save how you are paid'));
      const saved = (await res.json()) as Details;
      setDetails(saved);
      setMethod(saved.method);
      setEmail(saved.paypalEmail ?? '');
      setNotice(saved.method === 'DIRECT_DEPOSIT' ? 'You will be paid by Direct Deposit.' : 'You will be paid by PayPal.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save how you are paid');
    } finally {
      setBusy(false);
    }
  }

  if (!details) return error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : <p className="text-sm text-gray-500">Loading…</p>;

  const field = 'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm';

  return (
    <form onSubmit={save} className="max-w-xl space-y-5">
      <p className="text-sm text-gray-600">
        Choose how you would like Support to pay you what you have earned. You can change this at any time, and the change applies
        to your next payment.
      </p>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>}

      <label className="block text-sm font-medium text-gray-700">
        Payment method
        <select value={method} onChange={(event) => setMethod(event.target.value as Method)} className={field}>
          <option value="PAYPAL">PayPal</option>
          <option value="DIRECT_DEPOSIT" disabled={!details.bankOnFile}>
            Direct Deposit{details.bankOnFile ? '' : ' (not available yet)'}
          </option>
        </select>
      </label>

      {!details.bankOnFile && details.bankInstructions && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{details.bankInstructions}</p>
      )}
      {(details.paypalFeePercent > 0 || details.directDepositFeePercent > 0) && (
        <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
          A fee is taken from each payment to cover payment charges:{' '}
          {details.paypalFeePercent > 0 ? `${details.paypalFeePercent}% for PayPal` : 'no fee for PayPal'}
          {' and '}
          {details.directDepositFeePercent > 0 ? `${details.directDepositFeePercent}% for Direct Deposit` : 'no fee for Direct Deposit'}. For example, a
          $100.00 payment reaches you as ${(100 - details.paypalFeePercent).toFixed(2)} by PayPal and $
          {(100 - details.directDepositFeePercent).toFixed(2)} by Direct Deposit.
        </p>
      )}
      {details.bankOnFile && (
        <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
          Support has your bank information from onboarding. To change it, contact Support.
        </p>
      )}

      {method === 'PAYPAL' && (
        <label className="block text-sm font-medium text-gray-700">
          PayPal email address
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} className={field} />
        </label>
      )}

      <button type="submit" disabled={busy} className="rounded-lg bg-purple-700 px-6 py-3 font-semibold text-white hover:bg-purple-800 disabled:opacity-50">
        {busy ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}

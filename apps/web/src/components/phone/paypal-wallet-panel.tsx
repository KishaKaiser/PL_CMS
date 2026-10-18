'use client';

import { useCallback, useEffect, useState } from 'react';
import { readMessage } from './phone-format';

interface WalletStatus {
  connected: boolean;
  payerEmail: string | null;
  minTopUpCents: number;
  maxTopUpCents: number;
  dailyCapCents: number;
  remainingTodayCents: number;
}

const dollars = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

/** Connect or remove the PayPal wallet used to add money during a call. */
export function PaypalWalletPanel() {
  const [status, setStatus] = useState<WalletStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/wallet/paypal');
      if (!res.ok) throw new Error(await readMessage(res, 'Could not load your PayPal wallet.'));
      setStatus((await res.json()) as WalletStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your PayPal wallet.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function connect() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/proxy/wallet/paypal/connect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ returnOrigin: window.location.origin }),
      });
      if (!res.ok) throw new Error(await readMessage(res, 'Could not start the PayPal connection.'));
      const { approveUrl } = (await res.json()) as { approveUrl: string };
      window.location.href = approveUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the PayPal connection.');
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm('Remove your PayPal wallet? You will no longer be offered to add money during calls.')) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/proxy/wallet/paypal', { method: 'DELETE' });
      if (!res.ok) throw new Error(await readMessage(res, 'Could not remove your PayPal wallet.'));
      setStatus((await res.json()) as WalletStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove your PayPal wallet.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-10 max-w-xl space-y-4 border-t pt-8">
      <h3 className="text-lg font-semibold text-gray-950">PayPal wallet for adding money during calls</h3>
      <p className="text-sm text-gray-600">
        Connect your PayPal wallet once. When your balance runs low during a call, you will hear a short menu and can press a key to add
        $10, $20, $50, or an amount of your choice (from $5 to $100) without hanging up. You can say no every time. We only charge your
        PayPal when you choose an amount, and never more than {status ? dollars(status.dailyCapCents) : 'the daily limit'} in 24 hours.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!status ? (
        !error && <p className="text-sm text-gray-500">Loading…</p>
      ) : status.connected ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          <p className="font-semibold">PayPal wallet connected{status.payerEmail ? ` (${status.payerEmail})` : ''}.</p>
          <p className="mt-1">You can add up to {dollars(status.remainingTodayCents)} more today.</p>
          <button
            type="button"
            onClick={() => void disconnect()}
            disabled={busy}
            className="mt-3 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Remove PayPal wallet'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void connect()}
          disabled={busy}
          className="rounded-lg bg-purple-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
        >
          {busy ? 'Opening PayPal…' : 'Connect my PayPal wallet'}
        </button>
      )}
    </div>
  );
}

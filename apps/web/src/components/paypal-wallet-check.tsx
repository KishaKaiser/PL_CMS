'use client';

import { useState } from 'react';

interface WalletCheck {
  environment: 'sandbox' | 'live';
  outcome: 'allowed' | 'not-enabled' | 'bad-credentials' | 'no-credentials' | 'inconclusive' | 'error';
  allowed: boolean;
  paypal: { name: string | null; message: string | null; debugId: string | null; status: number } | null;
}

const RESULT: Record<WalletCheck['outcome'], { tone: 'good' | 'bad' | 'warn'; headline: string; detail: (env: string) => string }> = {
  allowed: {
    tone: 'good',
    headline: 'Allowed: PayPal accepted a request to save a PayPal wallet.',
    detail: (env) =>
      `Saving customers' PayPal wallets is switched on for this app on ${env}. Nothing was saved or charged. One step is still untested: charging a saved wallet later, while the client is on a call. That is proven by the first real top-up.${
        env === 'sandbox' ? ' This was the sandbox (test) environment, which usually allows more than the live account does. Switch the environment to Live and run the check again for the answer that matters.' : ''
      }`,
  },
  'not-enabled': {
    tone: 'bad',
    headline: 'Not enabled: PayPal refused to save a wallet with this app.',
    detail: (env) =>
      `The keys work, but saving PayPal wallets is not enabled for this app on ${env}. Ask PayPal to enable Vault v3 and PayPal Billing Agreements (reference transactions, with merchant-initiated charges) for this app, then run the check again.`,
  },
  'bad-credentials': {
    tone: 'bad',
    headline: 'PayPal did not accept the saved keys.',
    detail: (env) =>
      `Check that the client ID and secret are from the ${env} app (not the other one), press Save Billing, and run the check again.`,
  },
  'no-credentials': {
    tone: 'warn',
    headline: 'No PayPal keys are saved yet.',
    detail: () => 'Enter the PayPal client ID and secret, press Save Billing, then run the check.',
  },
  inconclusive: {
    tone: 'warn',
    headline: 'PayPal found a problem with the request, so this check cannot decide.',
    detail: () => 'PayPal said the following. Send it to me and I can adjust the check.',
  },
  error: {
    tone: 'warn',
    headline: 'The check could not finish.',
    detail: () => 'PayPal could not be reached or had a problem. Try again in a few minutes.',
  },
};

const TONES = {
  good: 'border-green-200 bg-green-50 text-green-900',
  bad: 'border-red-200 bg-red-50 text-red-900',
  warn: 'border-amber-200 bg-amber-50 text-amber-900',
};

/** Asks PayPal, with the saved billing keys, whether this app may save customers' PayPal wallets. Saves and charges nothing. */
export function PaypalWalletCheck() {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<WalletCheck | null>(null);
  const [error, setError] = useState('');

  async function run() {
    setChecking(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/proxy/admin/paypal/check-wallet-access', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ returnOrigin: window.location.origin }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        throw new Error(Array.isArray(body.message) ? body.message.join(' ') : (body.message ?? `The check failed (HTTP ${res.status}).`));
      }
      setResult((await res.json()) as WalletCheck);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The check failed.');
    } finally {
      setChecking(false);
    }
  }

  const view = result ? RESULT[result.outcome] : null;

  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-4">
      <h3 className="text-sm font-semibold text-gray-900">Saved PayPal wallets</h3>
      <p className="mt-1 text-sm text-gray-600">
        Letting clients add money during a call from a saved PayPal wallet needs PayPal to allow wallet saving for this app. This check asks
        PayPal using the billing settings you have <span className="font-medium">saved</span>. Nothing is saved and no one is charged.
      </p>
      <button
        type="button"
        onClick={() => void run()}
        disabled={checking}
        className="mt-3 rounded border border-indigo-300 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
      >
        {checking ? 'Checking with PayPal…' : 'Check PayPal wallet access'}
      </button>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      {result && view && (
        <div className={`mt-3 rounded border px-4 py-3 text-sm ${TONES[view.tone]}`}>
          <p className="font-semibold">
            {view.headline}{' '}
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium uppercase">{result.environment}</span>
          </p>
          <p className="mt-1">{view.detail(result.environment)}</p>
          {result.paypal && (
            <p className="mt-2 text-xs opacity-80">
              PayPal said: {result.paypal.status} {result.paypal.name ?? ''} {result.paypal.message ? `· ${result.paypal.message}` : ''}
              {result.paypal.debugId ? ` · reference ${result.paypal.debugId}` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

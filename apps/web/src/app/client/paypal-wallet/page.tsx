'use client';

import { useEffect, useRef, useState } from 'react';

type Result = { state: 'working' } | { state: 'done'; payerEmail: string | null } | { state: 'failed'; message: string };

/** Where PayPal sends a client back after they approve (or cancel) connecting their wallet. */
export default function PaypalWalletReturnPage() {
  const [result, setResult] = useState<Result>({ state: 'working' });
  const started = useRef(false);

  useEffect(() => {
    // The page can run its effect twice in development; the connection must only be finished once.
    if (started.current) return;
    started.current = true;

    fetch('/api/proxy/wallet/paypal/complete', { method: 'POST' })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[]; payerEmail?: string | null };
        if (!res.ok) {
          const message = Array.isArray(body.message) ? body.message.join(' ') : body.message;
          setResult({ state: 'failed', message: message ?? 'The PayPal connection was not completed.' });
          return;
        }
        setResult({ state: 'done', payerEmail: body.payerEmail ?? null });
      })
      .catch(() => setResult({ state: 'failed', message: 'We could not reach the server. Please try again.' }));
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-md">
        {result.state === 'working' && <p className="text-gray-600">Finishing your PayPal connection…</p>}

        {result.state === 'done' && (
          <>
            <h1 className="text-2xl font-bold text-gray-900">PayPal wallet connected</h1>
            <p className="mt-3 text-sm text-gray-600">
              {result.payerEmail ? `${result.payerEmail} is now saved. ` : ''}When your balance runs low during a call, you will be offered the
              chance to add money. You can always say no.
            </p>
          </>
        )}

        {result.state === 'failed' && (
          <>
            <h1 className="text-2xl font-bold text-gray-900">PayPal was not connected</h1>
            <p className="mt-3 text-sm text-gray-600">{result.message}</p>
          </>
        )}

        {result.state !== 'working' && (
          <a href="/client" className="mt-6 inline-block rounded bg-purple-700 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-800">
            Back to my dashboard
          </a>
        )}
      </div>
    </main>
  );
}

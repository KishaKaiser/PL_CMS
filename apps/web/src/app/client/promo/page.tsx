'use client';

import { useEffect, useRef, useState } from 'react';

type Result =
  | { state: 'working' }
  | { state: 'done'; minutes: number }
  | { state: 'cancelled' }
  | { state: 'failed'; message: string };

/** Where PayPal sends a client back after they pay (or cancel) for the new customer promotion. */
export default function PromoReturnPage() {
  const [result, setResult] = useState<Result>({ state: 'working' });
  const started = useRef(false);

  useEffect(() => {
    // The page can run its effect twice in development; the payment must only be taken once.
    if (started.current) return;
    started.current = true;

    // PayPal adds the id of the payment to the address they come back to (as "token").
    const params = new URLSearchParams(window.location.search);
    const paypalOrderId = params.get('token');
    const cancelled = params.get('cancelled') === '1';
    if (!paypalOrderId) {
      setResult(cancelled ? { state: 'cancelled' } : { state: 'failed', message: 'This page needs the payment from PayPal. Start the offer again from your account.' });
      return;
    }

    fetch(`/api/proxy/free-minutes/promo/${cancelled ? 'cancel' : 'complete'}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paypalOrderId }),
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[]; minutes?: number };
        if (cancelled) return setResult({ state: 'cancelled' });
        if (!res.ok) {
          const message = Array.isArray(body.message) ? body.message.join(' ') : body.message;
          return setResult({ state: 'failed', message: message ?? 'The payment was not completed.' });
        }
        setResult({ state: 'done', minutes: body.minutes ?? 0 });
      })
      .catch(() => setResult({ state: 'failed', message: 'We could not reach the server. Please try again.' }));
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-md">
        {result.state === 'working' && <p className="text-gray-600">Confirming your payment with PayPal…</p>}

        {result.state === 'done' && (
          <>
            <h1 className="text-2xl font-bold text-gray-900">Your minutes are ready</h1>
            <p className="mt-3 text-sm text-gray-600">
              {result.minutes} promotional minutes were added to your account. They work with any advisor and are used before your wallet is charged.
            </p>
          </>
        )}

        {result.state === 'cancelled' && (
          <>
            <h1 className="text-2xl font-bold text-gray-900">No payment was taken</h1>
            <p className="mt-3 text-sm text-gray-600">You can claim the offer whenever you are ready.</p>
          </>
        )}

        {result.state === 'failed' && (
          <>
            <h1 className="text-2xl font-bold text-gray-900">The offer was not completed</h1>
            <p className="mt-3 text-sm text-gray-600">{result.message}</p>
          </>
        )}

        {result.state !== 'working' && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a href="/phone-readings" className="inline-block rounded bg-purple-700 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-800">
              Find an advisor
            </a>
            <a href="/client" className="inline-block rounded border px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              My dashboard
            </a>
          </div>
        )}
      </div>
    </main>
  );
}

'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

/** The page behind the link at the bottom of a cart reminder. It takes a click on the button, not just opening the link. */
function Form() {
  const params = useSearchParams();
  const email = params.get('email') ?? '';
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');

  async function stop() {
    setState('working');
    try {
      const res = await fetch('/api/proxy/store/cart-recovery/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  }

  if (!email || !token) return <p className="text-gray-700">This link is not complete. Please use the link in the email you received.</p>;
  if (state === 'done') {
    return <p className="rounded-lg bg-green-50 px-4 py-3 text-green-800">Done. You will not get cart reminders any more.</p>;
  }

  return (
    <div>
      <p className="text-gray-700">
        Stop cart reminder emails to <strong className="break-all">{email}</strong>?
      </p>
      {state === 'error' && <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">This link did not work. It may be incomplete or out of date.</p>}
      <button
        type="button"
        onClick={() => void stop()}
        disabled={state === 'working'}
        className="mt-5 rounded bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {state === 'working' ? 'Working...' : 'Stop the reminders'}
      </button>
    </div>
  );
}

export default function CartReminderUnsubscribePage() {
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-bold">Cart reminders</h1>
      <Suspense fallback={<p className="text-gray-500">Loading…</p>}>
        <Form />
      </Suspense>
    </main>
  );
}

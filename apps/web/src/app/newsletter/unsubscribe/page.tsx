'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * The page behind the unsubscribe link in newsletter emails. Unsubscribing takes a click on the button (not just opening the
 * link), so mail apps that open links to check them do not unsubscribe anyone by accident.
 */
function UnsubscribeForm() {
  const params = useSearchParams();
  const email = params.get('email') ?? '';
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');

  async function unsubscribe() {
    setState('working');
    try {
      const res = await fetch('/api/proxy/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  }

  if (!email || !token) {
    return <p className="text-gray-700">This unsubscribe link is not complete. Please use the link in the email you received.</p>;
  }

  if (state === 'done') {
    return <p className="rounded-lg bg-green-50 px-4 py-3 text-green-800">You have been unsubscribed. You will not get our newsletter any more.</p>;
  }

  return (
    <div>
      <p className="text-gray-700">
        Stop sending the newsletter to <strong className="break-all">{email}</strong>?
      </p>
      {state === 'error' && <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">This link did not work. It may be incomplete or out of date.</p>}
      <button
        type="button"
        onClick={() => void unsubscribe()}
        disabled={state === 'working'}
        className="mt-5 rounded bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {state === 'working' ? 'Unsubscribing...' : 'Unsubscribe'}
      </button>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-bold">Unsubscribe</h1>
      <Suspense fallback={<p className="text-gray-500">Loading…</p>}>
        <UnsubscribeForm />
      </Suspense>
    </main>
  );
}

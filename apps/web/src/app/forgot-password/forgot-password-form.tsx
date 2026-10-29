'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';

/** Asks for the email address (or username) and has a link to choose a new password emailed. It never says whether an account exists. */
export function ForgotPasswordForm() {
  const [identifier, setIdentifier] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setState('sending');
    setError('');
    try {
      const res = await fetch('/api/proxy/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      if (res.status === 429) throw new Error('Too many tries. Please wait a minute and try again.');
      if (!res.ok) throw new Error('Something went wrong. Please try again.');
      setState('done');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setState('idle');
    }
  }

  return (
    <main className="min-h-[calc(100vh-96px)] bg-[radial-gradient(circle_at_top_left,#fff3dc_0,#fff7ed_26%,#faf5ff_72%,#ffffff_100%)] px-4 py-12 sm:px-8 lg:py-20">
      <section className="mx-auto w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl shadow-purple-950/10 sm:p-10">
        <h1 className="text-center text-3xl font-bold tracking-tight text-[#2d155f]">Forgot your password?</h1>

        {state === 'done' ? (
          <div className="mt-6 space-y-4 text-center">
            <p role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              If an account matches, we have emailed it a link to choose a new password. The link works for an hour.
            </p>
            <p className="text-sm text-gray-500">Nothing in your inbox after a few minutes? Check your junk folder.</p>
            <Link href="/login" className="inline-block text-sm font-medium text-purple-700 hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <p className="text-center text-sm text-gray-500">Enter your email address or username and we will email you a link to choose a new password.</p>
            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="identifier" className="mb-2 block text-sm font-medium text-gray-900">
                Email or username
              </label>
              <input
                id="identifier"
                type="text"
                required
                maxLength={254}
                autoComplete="username"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className="h-14 w-full rounded-xl border border-gray-300 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
              />
            </div>
            <button
              type="submit"
              disabled={state === 'sending' || !identifier.trim()}
              className="h-14 w-full rounded-xl bg-purple-700 text-base font-semibold text-white transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state === 'sending' ? 'Sending…' : 'Email me a link'}
            </button>
            <p className="text-center text-sm">
              <Link href="/login" className="font-medium text-purple-700 hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </section>
    </main>
  );
}

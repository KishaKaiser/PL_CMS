'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

const MIN_LENGTH = 8;
const MAX_LENGTH = 72;

/** Choosing a new password with the link from the email. The secret is taken out of the address bar as soon as the page opens. */
export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [token] = useState(() => searchParams.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle');
  const [error, setError] = useState('');
  const [linkProblem, setLinkProblem] = useState(false);

  useEffect(() => {
    if (token) window.history.replaceState(null, '', '/reset-password');
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (password.length < MIN_LENGTH) return setError(`Choose a password with at least ${MIN_LENGTH} characters.`);
    if (password.length > MAX_LENGTH) return setError(`Choose a password with at most ${MAX_LENGTH} characters.`);
    if (password !== confirm) return setError('The two passwords are not the same.');

    setState('saving');
    try {
      const res = await fetch('/api/proxy/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (res.ok) {
        setState('done');
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
      const message = Array.isArray(body.message) ? body.message.join(' ') : (body.message ?? '');
      if (res.status === 429) setError('Too many tries. Please wait a minute and try again.');
      else if (message.includes('expired or was already used')) setLinkProblem(true);
      else setError(message || 'The password could not be changed. Please try again.');
      setState('idle');
    } catch {
      setError('Network error. Please try again.');
      setState('idle');
    }
  }

  const missing = !token && state !== 'done';

  return (
    <main className="min-h-[calc(100vh-96px)] bg-[radial-gradient(circle_at_top_left,#fff3dc_0,#fff7ed_26%,#faf5ff_72%,#ffffff_100%)] px-4 py-12 sm:px-8 lg:py-20">
      <section className="mx-auto w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl shadow-purple-950/10 sm:p-10">
        <h1 className="text-center text-3xl font-bold tracking-tight text-[#2d155f]">Choose a new password</h1>

        {state === 'done' ? (
          <div className="mt-6 space-y-4 text-center">
            <p role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              Your password was changed. You can sign in with it now.
            </p>
            <Link href="/login?reset=1" className="inline-block rounded-xl bg-purple-700 px-6 py-3 text-sm font-semibold text-white hover:bg-purple-800">
              Sign in
            </Link>
          </div>
        ) : missing || linkProblem ? (
          <div className="mt-6 space-y-4 text-center">
            <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {linkProblem ? 'This link has expired or was already used.' : 'This link is not complete. Please use the link in your email, or ask for a new one.'}
            </p>
            <Link href="/forgot-password" className="inline-block text-sm font-medium text-purple-700 hover:underline">
              Ask for a new link
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-gray-900">
                New password
              </label>
              <input
                id="new-password"
                type={show ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-14 w-full rounded-xl border border-gray-300 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
              />
              <p className="mt-1 text-xs text-gray-500">At least {MIN_LENGTH} characters.</p>
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-gray-900">
                Type it again
              </label>
              <input
                id="confirm-password"
                type={show ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className="h-14 w-full rounded-xl border border-gray-300 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={show} onChange={(event) => setShow(event.target.checked)} />
              Show the password
            </label>
            <button
              type="submit"
              disabled={state === 'saving'}
              className="h-14 w-full rounded-xl bg-purple-700 text-base font-semibold text-white transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state === 'saving' ? 'Saving…' : 'Change my password'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

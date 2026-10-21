'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type LinkState = 'loading' | 'ready' | 'activated' | 'expired' | 'invalid';

const field = 'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600';

export function ActivateForm() {
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<LinkState>('loading');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setState('invalid');
      return;
    }
    fetch(`/api/proxy/advisor-onboarding/link?token=${encodeURIComponent(token)}`)
      .then((res): Promise<{ state: LinkState; name?: string }> | { state: LinkState; name?: string } => (res.ok ? (res.json() as Promise<{ state: LinkState; name?: string }>) : { state: 'invalid' }))
      .then((data) => {
        setState(data.state);
        setName(data.name ?? '');
      })
      .catch(() => setState('invalid'));
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (password.length < 8) return setError('Your password must be at least 8 characters.');
    if (password !== confirm) return setError('The two passwords do not match.');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message ?? 'This link could not be used.');
      }
      window.location.href = '/advisor/onboarding';
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'This link could not be used.');
      setBusy(false);
    }
  }

  if (state === 'loading') return <p className="text-gray-500">Checking your link…</p>;

  if (state === 'activated') {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">Your account is already set up</h2>
        <p className="mt-2 text-gray-600">Sign in to carry on with your onboarding checklist.</p>
        <a href="/login?next=/advisor/onboarding" className="mt-4 inline-block rounded-lg bg-purple-700 px-6 py-3 font-semibold text-white hover:bg-purple-800">
          Sign in
        </a>
      </div>
    );
  }

  if (state !== 'ready') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="text-xl font-semibold text-amber-900">{state === 'expired' ? 'This link has expired' : 'This link is not valid'}</h2>
        <p className="mt-2 text-amber-900">Contact Support and ask for a new onboarding link.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Welcome{name ? `, ${name}` : ''}!</h2>
      <p className="text-gray-600">
        Your application was approved. Create a password to start onboarding. You will use it, with your email address, to sign in from
        now on.
      </p>
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <label className="block text-sm font-medium text-gray-800">
        Password
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" className={field} />
        <span className="mt-1 block text-xs font-normal text-gray-500">At least 8 characters.</span>
      </label>
      <label className="block text-sm font-medium text-gray-800">
        Confirm password
        <input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required autoComplete="new-password" className={field} />
      </label>
      <button type="submit" disabled={busy} className="rounded-lg bg-purple-700 px-8 py-3 font-semibold text-white hover:bg-purple-800 disabled:opacity-50">
        {busy ? 'Setting up...' : 'Create password and start'}
      </button>
    </form>
  );
}

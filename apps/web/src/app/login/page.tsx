'use client';

import { useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const SAFE_REDIRECT_ORIGIN = 'https://placeholder.local';

function getSafeNextPath(nextPath: string | null) {
  if (!nextPath) return '/admin';
  if (nextPath.includes('\\')) return '/admin';

  try {
    const parsed = new URL(nextPath, SAFE_REDIRECT_ORIGIN);
    if (parsed.origin !== SAFE_REDIRECT_ORIGIN) return '/admin';
    const safePath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return safePath.startsWith('/') ? safePath : '/admin';
  } catch {
    return '/admin';
  }
}

async function readErrorMessage(res: Response, fallback: string) {
  const contentType = res.headers.get('content-type');
  if (!contentType?.includes('application/json')) return fallback;

  const data = (await res.json().catch(() => null)) as { message?: string } | null;
  return data?.message ?? fallback;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        setError(await readErrorMessage(res, 'Login failed'));
        return;
      }

      const next = getSafeNextPath(searchParams.get('next'));
      router.push(next);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm rounded-lg border bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-bold">Sign In</h1>
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="email">
              Email or username
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              aria-invalid={Boolean(error)}
              className="w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="you@example.com or username"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              aria-invalid={Boolean(error)}
              className="w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-indigo-600 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

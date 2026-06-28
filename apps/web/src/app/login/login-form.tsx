'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getDashboardPathForRole } from '../../lib/account-routing';

const SAFE_REDIRECT_ORIGIN = 'https://placeholder.local';

function getSafeNextPath(nextPath: string | null, fallbackPath: string) {
  if (!nextPath) return fallbackPath;
  if (nextPath.includes('\\')) return fallbackPath;

  try {
    const parsed = new URL(nextPath, SAFE_REDIRECT_ORIGIN);
    if (parsed.origin !== SAFE_REDIRECT_ORIGIN) return fallbackPath;
    const safePath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return safePath.startsWith('/') ? safePath : fallbackPath;
  } catch {
    return fallbackPath;
  }
}

async function readErrorMessage(res: Response, fallback: string) {
  const contentType = res.headers.get('content-type');
  if (!contentType?.includes('application/json')) return fallback;

  const data = (await res.json().catch(() => null)) as { message?: string } | null;
  return data?.message ?? fallback;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

      const data = (await res.json().catch(() => ({}))) as { role?: string };
      const dashboardPath = getDashboardPathForRole(data.role);
      const next = getSafeNextPath(searchParams.get('next'), dashboardPath);
      router.push(next);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-96px)] bg-[radial-gradient(circle_at_top_left,#fff3dc_0,#fff7ed_26%,#faf5ff_72%,#ffffff_100%)] px-4 py-12 sm:px-8 lg:py-20">
      <section className="mx-auto grid w-full max-w-7xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-purple-950/10 lg:grid-cols-[1fr_1fr]">
        <div className="relative hidden min-h-[620px] overflow-hidden bg-gradient-to-br from-[#443282] via-[#a893cc] to-[#f5a05d] lg:block">
          <img
            src="/login/login-art.png"
            alt="Psychic advisor illustration"
            className="absolute inset-x-0 bottom-0 mx-auto h-[96%] w-auto max-w-full object-contain"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-purple-900/10 via-transparent to-orange-100/15" />
        </div>

        <div className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-16">
          <div className="w-full max-w-md">
            <div className="mb-9 text-center">
              <h1 className="text-4xl font-bold tracking-tight text-[#2d155f] sm:text-5xl">
                Welcome Back
              </h1>
              <p className="mt-3 text-sm text-gray-500">Sign in to continue your journey</p>
            </div>

            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900" htmlFor="email">
                  Email or Username
                </label>
                <div className="flex h-14 items-center gap-3 rounded-xl border border-gray-300 bg-white px-4 transition focus-within:border-purple-500 focus-within:ring-4 focus-within:ring-purple-100">
                  <i className="fa-regular fa-user text-lg text-gray-700" aria-hidden="true" />
                  <input
                    id="email"
                    type="text"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="username"
                    aria-invalid={Boolean(error)}
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                    placeholder="Enter your email or username"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900" htmlFor="password">
                  Password
                </label>
                <div className="flex h-14 items-center gap-3 rounded-xl border border-gray-300 bg-white px-4 transition focus-within:border-purple-500 focus-within:ring-4 focus-within:ring-purple-100">
                  <i className="fa-solid fa-lock text-base text-gray-700" aria-hidden="true" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    aria-invalid={Boolean(error)}
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="text-lg text-gray-400 transition hover:text-purple-700"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <i className={showPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'} aria-hidden="true" />
                  </button>
                </div>
                <div className="mt-2 text-right">
                  <Link href="/login" className="text-sm font-medium text-purple-700 hover:text-purple-800 hover:underline">
                    Forgot password?
                  </Link>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="h-14 w-full rounded-xl bg-[#7445ad] text-base font-semibold text-white shadow-lg shadow-purple-900/15 transition hover:bg-[#63379c] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="my-6 flex items-center gap-4 text-sm text-gray-400">
              <span className="h-px flex-1 bg-gray-200" />
              <span>or</span>
              <span className="h-px flex-1 bg-gray-200" />
            </div>

            <Link
              href="/forms/registration"
              className="flex h-14 w-full items-center justify-center gap-3 rounded-xl border border-purple-500 text-base font-semibold text-purple-700 transition hover:bg-purple-50"
            >
              <i className="fa-solid fa-user-plus text-lg" aria-hidden="true" />
              Create an Account
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

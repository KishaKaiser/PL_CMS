'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? '';

interface StatusResponse {
  installed: boolean;
  hasAdmin: boolean;
  db: { connected: boolean };
}

export default function InstallPage() {
  const router = useRouter();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/api/install/status`)
      .then((r) => r.json())
      .then((data: StatusResponse) => {
        setStatus(data);
        if (data.installed) {
          router.replace('/login');
        }
      })
      .catch(() => setError('Unable to reach the API. Check your configuration.'));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/install/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: name.trim() || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message ?? 'Installation failed. See API logs.');
      } else {
        setMessage('Installation complete! Redirecting to login…');
        setTimeout(() => router.replace('/login'), 2000);
      }
    } catch {
      setError('Network error — could not contact the API.');
    } finally {
      setLoading(false);
    }
  }

  if (status === null && !error) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <p className="text-gray-500">Checking installation status…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm rounded-lg border bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-bold text-indigo-700">
          Psychic Link CMS
        </h1>
        <p className="mb-6 text-sm text-gray-500">Web Installer</p>

        {status && (
          <div className="mb-4 rounded bg-gray-50 p-3 text-xs text-gray-600">
            <span
              className={
                status.db.connected ? 'text-green-600' : 'text-red-600'
              }
            >
              ● DB {status.db.connected ? 'connected' : 'not connected'}
            </span>
          </div>
        )}

        {error && (
          <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {message && (
          <p className="mb-4 rounded bg-green-50 p-3 text-sm text-green-700">
            {message}
          </p>
        )}

        {!message && (
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div>
              <label
                className="mb-1 block text-sm font-medium"
                htmlFor="name"
              >
                Admin Name (optional)
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Admin"
              />
            </div>
            <div>
              <label
                className="mb-1 block text-sm font-medium"
                htmlFor="email"
              >
                Admin Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <label
                className="mb-1 block text-sm font-medium"
                htmlFor="password"
              >
                Admin Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Minimum 8 characters"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !status?.db.connected}
              className="rounded bg-indigo-600 py-2 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Installing…' : 'Run Installation'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

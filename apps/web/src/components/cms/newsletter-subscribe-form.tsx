'use client';

import { useState } from 'react';

export function NewsletterSubscribeForm({
  title = 'Join Our Newsletter',
  description = '',
  layout = 'vertical',
  placeholder = 'Email address',
  buttonLabel = 'Subscribe',
}: {
  title?: string;
  description?: string;
  layout?: 'horizontal' | 'vertical';
  placeholder?: string;
  buttonLabel?: string;
}) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const horizontal = layout === 'horizontal';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/proxy/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(body.message ?? 'Could not subscribe.');
      setMessage(body.message ?? 'Thank you for subscribing.');
      setEmail('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not subscribe.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {title && <h2 className="text-2xl font-semibold text-gray-950">{title}</h2>}
      {description && <p className="mt-2 text-sm text-gray-600">{description}</p>}
      <form onSubmit={submit} className={`mt-5 ${horizontal ? 'grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]' : 'space-y-3'}`}>
        <input
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-purple-600 px-5 py-3 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {submitting ? 'Subscribing...' : buttonLabel}
        </button>
      </form>
      {message && <p className="mt-3 rounded bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}
      {error && <p className="mt-3 rounded bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}

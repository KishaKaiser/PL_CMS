'use client';

import { FormEvent, useState } from 'react';

async function readError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  if (Array.isArray(data?.message)) return data.message.join(' ');
  return data?.message ?? fallback;
}

const field = 'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600';

/** The public Advisor Application. An admin reviews every application before anyone is invited to onboard. */
export function AdvisorApplicationForm() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', yearsExperience: '', gifts: '', readingStyle: '', website: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const years = Number(form.yearsExperience);
      if (!Number.isInteger(years) || years < 0 || years > 80) throw new Error('Enter your years of professional experience as a whole number.');
      const res = await fetch('/api/proxy/advisor-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, yearsExperience: years }),
      });
      if (!res.ok) throw new Error(await readError(res, 'We could not send your application. Please try again.'));
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'We could not send your application. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {sent ? (
            <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <h2 className="text-xl font-semibold text-emerald-900">Thank you for applying</h2>
              <p className="mt-2 text-emerald-900">
                We have your application and will review it soon. If it is approved, we will email you at <strong>{form.email}</strong> with
                your link to start onboarding.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
              {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
  
              <label className="block text-sm font-medium text-gray-800">
                Name
                <input value={form.name} onChange={set('name')} required minLength={2} maxLength={120} autoComplete="name" className={field} />
              </label>
  
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-medium text-gray-800">
                  Email address
                  <input type="email" value={form.email} onChange={set('email')} required maxLength={254} autoComplete="email" className={field} />
                </label>
                <label className="block text-sm font-medium text-gray-800">
                  Phone number
                  <input type="tel" value={form.phone} onChange={set('phone')} required maxLength={30} autoComplete="tel" placeholder="(555) 123-4567" className={field} />
                </label>
              </div>
  
              <label className="block text-sm font-medium text-gray-800">
                Years of professional experience
                <input type="number" min={0} max={80} step={1} value={form.yearsExperience} onChange={set('yearsExperience')} required className={`${field} sm:w-40`} />
              </label>
  
              <label className="block text-sm font-medium text-gray-800">
                Tell us about your gifts &amp; experience
                <textarea value={form.gifts} onChange={set('gifts')} required minLength={10} maxLength={3000} rows={6} className={field} />
                <span className="mt-1 block text-xs font-normal text-gray-500">{form.gifts.length}/3000</span>
              </label>
  
              <label className="block text-sm font-medium text-gray-800">
                Describe your reading style
                <textarea value={form.readingStyle} onChange={set('readingStyle')} required minLength={10} maxLength={3000} rows={6} className={field} />
                <span className="mt-1 block text-xs font-normal text-gray-500">{form.readingStyle.length}/3000</span>
              </label>
  
              {/* Visitors never see this; a bot that fills it in is ignored. */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
                <label>
                  Website
                  <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
                </label>
              </div>
  
              <button type="submit" disabled={busy} className="rounded-lg bg-purple-700 px-8 py-3 font-semibold text-white hover:bg-purple-800 disabled:opacity-50">
                {busy ? 'Sending...' : 'Submit application'}
              </button>
            </form>
          )}
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';

interface NewsletterSettings {
  defaultTitle: string;
  defaultDescription: string;
  defaultButtonLabel: string;
  defaultPlaceholder: string;
  collectName: boolean;
  privacyPolicyUrl: string;
  termsUrl: string;
  consentText: string;
  gdprNotice: string;
}

export function NewsletterSubscribeForm({
  title,
  description,
  layout = 'vertical',
  placeholder,
  buttonLabel,
  collectName,
}: {
  title?: string;
  description?: string;
  layout?: 'horizontal' | 'vertical';
  placeholder?: string;
  buttonLabel?: string;
  collectName?: boolean;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [termsConsent, setTermsConsent] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState<NewsletterSettings | null>(null);
  const horizontal = layout === 'horizontal';
  const resolvedTitle = title ?? settings?.defaultTitle ?? 'Join Our Newsletter';
  const resolvedDescription = description ?? settings?.defaultDescription ?? '';
  const resolvedPlaceholder = placeholder ?? settings?.defaultPlaceholder ?? 'Email address';
  const resolvedButtonLabel = buttonLabel ?? settings?.defaultButtonLabel ?? 'Subscribe';
  const resolvedCollectName = collectName ?? settings?.collectName ?? false;

  useEffect(() => {
    fetch('/api/proxy/newsletter/settings')
      .then((res) => res.ok ? res.json() : null)
      .then((data: NewsletterSettings | null) => {
        if (data) setSettings(data);
      })
      .catch(() => undefined);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/proxy/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, source: 'website', privacyConsent, termsConsent }),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(body.message ?? 'Could not subscribe.');
      setMessage(body.message ?? 'Thank you for subscribing.');
      setName('');
      setEmail('');
      setPrivacyConsent(false);
      setTermsConsent(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not subscribe.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {resolvedTitle && <h2 className="text-2xl font-semibold text-gray-950">{resolvedTitle}</h2>}
      {resolvedDescription && <p className="mt-2 text-sm text-gray-600">{resolvedDescription}</p>}
      <form onSubmit={submit} className={`mt-5 ${horizontal ? 'grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]' : 'space-y-3'}`}>
        {resolvedCollectName && (
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
            className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm"
          />
        )}
        <input
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={resolvedPlaceholder}
          className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm"
        />
        <div className={horizontal ? 'sm:col-span-2' : ''}>
          <label className="flex items-start gap-2 text-xs leading-5 text-gray-600">
            <input
              required
              type="checkbox"
              checked={privacyConsent && termsConsent}
              onChange={(event) => {
                setPrivacyConsent(event.target.checked);
                setTermsConsent(event.target.checked);
              }}
              className="mt-1"
            />
            <span>
              {settings?.consentText ?? 'I agree to the privacy policy and terms and conditions.'}{' '}
              <a href={settings?.privacyPolicyUrl ?? '/privacy-policy'} className="text-purple-700 hover:underline">Privacy Policy</a>
              {' '}and{' '}
              <a href={settings?.termsUrl ?? '/terms'} className="text-purple-700 hover:underline">Terms and Conditions</a>.
            </span>
          </label>
          {settings?.gdprNotice && <p className="mt-2 text-xs leading-5 text-gray-500">{settings.gdprNotice}</p>}
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-purple-600 px-5 py-3 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {submitting ? 'Subscribing...' : resolvedButtonLabel}
        </button>
      </form>
      {message && <p className="mt-3 rounded bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}
      {error && <p className="mt-3 rounded bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}

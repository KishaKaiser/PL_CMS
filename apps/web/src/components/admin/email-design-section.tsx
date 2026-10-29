'use client';

import { useEffect, useState } from 'react';

export interface EmailDesignFields {
  accentColor: string;
  showLogo: boolean;
  showSiteName: boolean;
  trackButtonLabel: string;
  signature: string;
  footerText: string;
}

const PREVIEWS: Array<{ key: string; label: string }> = [
  { key: 'order_confirmation', label: 'Order confirmation (to the customer)' },
  { key: 'order_progress', label: 'Order update (to the customer)' },
  { key: 'order_shipped', label: 'Order shipped (to the customer)' },
  { key: 'order_alert', label: 'New order (to you)' },
  { key: 'form_alert', label: 'Form submission (to you)' },
];

const inputClass = 'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm';

/**
 * What the emails look like: the color, the logo and name at the top, the button label, a sign-off and the small line at the
 * bottom, with a preview that updates as you change them. (The wording of each email is edited in Store settings → Emails.)
 */
export function EmailDesignSection({ design, onChange }: { design: EmailDesignFields; onChange: (patch: Partial<EmailDesignFields>) => void }) {
  const [template, setTemplate] = useState('order_confirmation');
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/proxy/admin/email-settings/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template, design }),
        });
        if (!res.ok) throw new Error('The preview could not be made.');
        const data = (await res.json()) as { subject: string; html: string };
        if (!cancelled) {
          setPreview(data);
          setError('');
        }
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'The preview could not be made.');
      }
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [template, design]);

  const toCustomer = template === 'order_confirmation' || template === 'order_progress' || template === 'order_shipped';

  return (
    <section className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Look of your emails</h2>
      <p className="text-sm text-gray-500">
        Change the color, logo and sign-off, and the preview on the right shows the result. Click <strong>Save</strong> above to keep your changes.
        To change the wording of an email, go to Store settings → Emails.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Color
            <div className="mt-1 flex items-center gap-3">
              <input
                type="color"
                value={design.accentColor}
                onChange={(event) => onChange({ accentColor: event.target.value })}
                className="h-10 w-16 cursor-pointer rounded border border-gray-200 bg-white"
              />
              <code className="text-xs text-gray-500">{design.accentColor}</code>
            </div>
            <span className="mt-1 block text-xs font-normal text-gray-500">Used for the button, the site name and links.</span>
          </label>

          <div className="space-y-2 text-sm text-gray-700">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={design.showLogo} onChange={(event) => onChange({ showLogo: event.target.checked })} />
              Show my logo at the top
            </label>
            <p className="pl-6 text-xs text-gray-500">Uses the logo from Settings → Site identity. If there isn&apos;t one, nothing is shown.</p>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={design.showSiteName} onChange={(event) => onChange({ showSiteName: event.target.checked })} />
              Show my site name at the top
            </label>
          </div>

          <label className="block text-sm font-medium text-gray-700">
            Words on the tracking button
            <input value={design.trackButtonLabel} maxLength={40} onChange={(event) => onChange({ trackButtonLabel: event.target.value })} className={inputClass} />
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Sign-off
            <textarea
              value={design.signature}
              rows={3}
              maxLength={500}
              onChange={(event) => onChange({ signature: event.target.value })}
              placeholder={'Thank you,\nThe Psychic Link'}
              className={inputClass}
            />
            <span className="mt-1 block text-xs font-normal text-gray-500">Added after the message in emails to customers.</span>
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Line at the bottom
            <textarea
              value={design.footerText}
              rows={2}
              maxLength={300}
              onChange={(event) => onChange({ footerText: event.target.value })}
              placeholder="Leave empty for “You are receiving this because you placed an order at …”"
              className={inputClass}
            />
            <span className="mt-1 block text-xs font-normal text-gray-500">The newsletter always keeps its unsubscribe line.</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Preview
            <select value={template} onChange={(event) => setTemplate(event.target.value)} className={inputClass}>
              {PREVIEWS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {preview && (
            <div className="mt-3">
              <p className="text-xs text-gray-500">
                Subject: <span className="font-medium text-gray-800">{preview.subject}</span>
              </p>
              {!toCustomer && <p className="text-xs text-gray-400">The sign-off and bottom line are only added to emails sent to customers.</p>}
              <iframe title="Email preview" sandbox="" srcDoc={preview.html} className="mt-2 h-[560px] w-full rounded border bg-gray-100" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

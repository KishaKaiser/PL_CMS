'use client';

import { useState } from 'react';
import type { PhoneProfile } from './phone-client';
import { readMessage } from './phone-format';

/** Asks a client who has no phone number on file where we should call them, then saves it. */
export function PhonePromptDialog({
  advisorName,
  primaryColor,
  onSaved,
  onClose,
}: {
  advisorName: string;
  primaryColor: string;
  onSaved: (profile: PhoneProfile) => void;
  onClose: () => void;
}) {
  const [phoneInput, setPhoneInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/proxy/phone/me', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phoneInput }),
      });
      if (!res.ok) throw new Error(await readMessage(res, 'Could not save your phone number'));
      onSaved((await res.json()) as PhoneProfile);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save your phone number');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">Where should we call you?</h2>
        <p className="mt-1 text-sm text-gray-600">We will ring this number, then connect you to {advisorName}.</p>
        <label className="mt-4 block text-sm font-medium text-gray-700">
          Your phone number
          <input
            value={phoneInput}
            onChange={(event) => setPhoneInput(event.target.value)}
            type="tel"
            autoComplete="tel"
            placeholder="(555) 123-4567"
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
            autoFocus
          />
        </label>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex gap-3">
          <button
            type="submit"
            disabled={saving || phoneInput.trim() === ''}
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}
          >
            {saving ? 'Saving…' : 'Save and call'}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2.5 text-sm hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

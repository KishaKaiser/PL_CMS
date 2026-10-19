'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

type Audience = 'CLIENTS' | 'ADVISORS' | 'BOTH';

interface Broadcast {
  id: string;
  subject: string;
  body: string;
  sentAt: string;
  recipientCount: number;
  audience: Audience;
}

const AUDIENCES: { value: Audience; label: string; hint: string }[] = [
  { value: 'CLIENTS', label: 'All clients', hint: 'Every client account.' },
  { value: 'ADVISORS', label: 'All advisors', hint: 'Every advisor account.' },
  { value: 'BOTH', label: 'Clients and advisors', hint: 'Everyone with a client or advisor account.' },
];

const AUDIENCE_LABEL: Record<Audience, string> = { CLIENTS: 'All clients', ADVISORS: 'All advisors', BOTH: 'Clients and advisors' };

async function readMessage(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
  if (Array.isArray(data.message)) return data.message.join(' ');
  return data.message ?? fallback;
}

export default function AdminBroadcastsPage() {
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [audience, setAudience] = useState<Audience>('CLIENTS');
  const [form, setForm] = useState({ subject: '', body: '' });
  const [open, setOpen] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/admin/broadcasts');
      if (res.ok) setHistory((await res.json()) as Broadcast[]);
    } catch {
      // keep the last list
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const label = AUDIENCE_LABEL[audience].toLowerCase();
    if (!window.confirm(`Send this message to ${label}? It cannot be taken back.`)) return;
    setSending(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/proxy/admin/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audience, ...form }),
      });
      if (!res.ok) throw new Error(await readMessage(res, 'Unable to send the message'));
      const result = (await res.json()) as { sent: number };
      setMessage(`Sent to ${result.sent} ${result.sent === 1 ? 'person' : 'people'}.`);
      setForm({ subject: '', body: '' });
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to send the message');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="text-3xl font-bold">Broadcast messages</h1>
      <p className="mt-1 text-sm text-gray-600">
        Write to every client, every advisor, or both. It lands in each person&apos;s inbox from Support, and they can reply to it.
      </p>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {message && <p className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}

      <form onSubmit={send} className="mt-6 space-y-4 rounded-lg border bg-white p-5 shadow-sm">
        <fieldset>
          <legend className="text-sm font-medium text-gray-700">Send to</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {AUDIENCES.map((option) => (
              <label
                key={option.value}
                className={`cursor-pointer rounded-lg border px-4 py-3 text-sm ${audience === option.value ? 'border-purple-600 bg-purple-50' : 'hover:bg-gray-50'}`}
              >
                <input type="radio" name="audience" value={option.value} checked={audience === option.value} onChange={() => setAudience(option.value)} className="mr-2" />
                <span className="font-medium">{option.label}</span>
                <span className="mt-1 block text-xs text-gray-500">{option.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm font-medium text-gray-700">
          Subject
          <input
            value={form.subject}
            onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
            maxLength={150}
            required
            className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-sm font-medium text-gray-700">
          Message
          <textarea
            value={form.body}
            onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
            rows={8}
            maxLength={5000}
            required
            className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm"
          />
        </label>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">{form.body.length}/5000</span>
          <button
            type="submit"
            disabled={sending || !form.subject.trim() || !form.body.trim()}
            className="rounded bg-purple-700 px-5 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50"
          >
            {sending ? 'Sending...' : `Send to ${AUDIENCE_LABEL[audience].toLowerCase()}`}
          </button>
        </div>
      </form>

      <h2 className="mt-10 text-lg font-semibold">Sent broadcasts</h2>
      <div className="mt-3 divide-y rounded-lg border bg-white">
        {history.map((item) => (
          <div key={item.id} className="px-4 py-3">
            <button type="button" onClick={() => setOpen(open === item.id ? null : item.id)} className="flex w-full items-center justify-between gap-3 text-left">
              <span className="min-w-0">
                <span className="block truncate font-medium text-gray-900">{item.subject}</span>
                <span className="text-xs text-gray-500">
                  {AUDIENCE_LABEL[item.audience]} · {item.recipientCount} recipient{item.recipientCount === 1 ? '' : 's'}
                </span>
              </span>
              <span className="shrink-0 text-xs text-gray-500">{new Date(item.sentAt).toLocaleString()}</span>
            </button>
            {open === item.id && <p className="mt-3 whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm text-gray-800">{item.body}</p>}
          </div>
        ))}
        {history.length === 0 && <p className="p-4 text-sm text-gray-500">Nothing sent yet.</p>}
      </div>
    </div>
  );
}

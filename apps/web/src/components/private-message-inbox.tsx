'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

interface MessageUser {
  id: string;
  name: string;
  role: string;
}

type Folder = 'inbox' | 'sent' | 'trash';

interface MessageSummary {
  id: string;
  threadId: string;
  subject: string;
  snippet: string;
  sentAt: string;
  readAt: string | null;
  unread: boolean;
  fromMe: boolean;
  folder: Folder;
  from: MessageUser;
  to: MessageUser;
}

interface MessageDetail extends MessageSummary {
  body: string;
}

interface ListResponse {
  folder: Folder;
  page: number;
  pageSize: number;
  total: number;
  messages: MessageSummary[];
}

interface Summary {
  unread: number;
  trash: number;
}

type View =
  | { kind: 'list' }
  | { kind: 'message'; id: string }
  | { kind: 'compose'; to: string; replyTo: { id: string; subject: string } | null };

interface PrivateMessageInboxProps {
  title?: string;
  description?: string;
  backHref?: string;
  embedded?: boolean;
}

const ROLE_LABELS: Record<string, string> = { SUPPORT: 'Support', ADVISOR: 'Advisor', CLIENT: 'Client' };
const roleLabel = (role: string) => ROLE_LABELS[role] ?? role;

const FOLDER_LABELS: Record<Folder, string> = { inbox: 'Inbox', sent: 'Sent', trash: 'Trash' };

/** Contacts get a search box once the list is long enough to need one. */
const SEARCH_THRESHOLD = 8;
const REFRESH_INTERVAL_MS = 30_000;

/** "3:42 PM" for today, "Oct 14" this year, "Oct 14, 2025" before that. */
function shortDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (date.getFullYear() === now.getFullYear()) return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const subjectOf = (subject: string) => subject.trim() || '(no subject)';

function replySubject(subject: string): string {
  const base = subjectOf(subject);
  return /^re:\s*/i.test(base) ? base : `Re: ${base}`;
}

async function readError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  if (Array.isArray(data?.message)) return data.message.join(' ');
  return data?.message ?? fallback;
}

/**
 * A mailbox: an inbox, sent and trash folders, messages with subjects, replies that stay in a thread, and an address
 * book of the people you can write to. Support is always in it; advisors and clients join it once you have been in
 * contact.
 */
export function PrivateMessageInbox({
  title = 'Messages',
  description = 'Write to Support and to the advisors or clients you have been in contact with.',
  backHref,
  embedded = false,
}: PrivateMessageInboxProps) {
  const [folder, setFolder] = useState<Folder>('inbox');
  const [view, setView] = useState<View>({ kind: 'list' });
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [list, setList] = useState<ListResponse | null>(null);
  const [summary, setSummary] = useState<Summary>({ unread: 0, trash: 0 });
  const [contacts, setContacts] = useState<MessageUser[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [detail, setDetail] = useState<{ message: MessageDetail; thread: MessageDetail[] } | null>(null);
  const [form, setForm] = useState({ subject: '', body: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/messages/summary');
      if (res.ok) setSummary((await res.json()) as Summary);
    } catch {
      // keep the last numbers
    }
  }, []);

  const loadList = useCallback(async () => {
    try {
      const params = new URLSearchParams({ folder, page: String(page) });
      if (search) params.set('q', search);
      const res = await fetch(`/api/proxy/messages?${params.toString()}`);
      if (!res.ok) throw new Error(await readError(res, 'Unable to load your messages'));
      setList((await res.json()) as ListResponse);
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load your messages');
    } finally {
      setLoading(false);
    }
  }, [folder, page, search]);

  useEffect(() => {
    fetch('/api/proxy/messages/contacts')
      .then((res) => (res.ok ? (res.json() as Promise<MessageUser[]>) : []))
      .then(setContacts)
      .catch(() => setContacts([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    void loadList();
    void loadSummary();
    const refresh = setInterval(() => {
      void loadList();
      void loadSummary();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(refresh);
  }, [loadList, loadSummary]);

  const visibleContacts = useMemo(() => {
    const term = contactSearch.trim().toLowerCase();
    return term ? contacts.filter((contact) => contact.name.toLowerCase().includes(term)) : contacts;
  }, [contacts, contactSearch]);

  function goToFolder(next: Folder) {
    setFolder(next);
    setPage(1);
    setSearchInput('');
    setSearch('');
    setView({ kind: 'list' });
    setNotice('');
    setError('');
  }

  async function openMessage(id: string) {
    setView({ kind: 'message', id });
    setDetail(null);
    setNotice('');
    setError('');
    try {
      const res = await fetch(`/api/proxy/messages/${id}`);
      if (!res.ok) throw new Error(await readError(res, 'Unable to open this message'));
      setDetail((await res.json()) as { message: MessageDetail; thread: MessageDetail[] });
      void loadSummary();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to open this message');
      setView({ kind: 'list' });
    }
  }

  function startCompose(to: string, replyTo: { id: string; subject: string } | null = null) {
    setForm({ subject: replyTo ? replySubject(replyTo.subject) : '', body: '' });
    setView({ kind: 'compose', to, replyTo });
    setNotice('');
    setError('');
  }

  async function act(path: string, method: 'POST' | 'DELETE' | 'PATCH', done: string) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/proxy/messages/${path}`, { method });
      if (!res.ok) throw new Error(await readError(res, 'That did not work'));
      setNotice(done);
      setView({ kind: 'list' });
      await Promise.all([loadList(), loadSummary()]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'That did not work');
    } finally {
      setBusy(false);
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (view.kind !== 'compose') return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/proxy/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: view.to,
          subject: form.subject,
          body: form.body,
          ...(view.replyTo ? { inReplyToId: view.replyTo.id } : {}),
        }),
      });
      if (!res.ok) throw new Error(await readError(res, 'Unable to send your message'));
      setForm({ subject: '', body: '' });
      setNotice('Your message was sent.');
      setFolder('sent');
      setPage(1);
      setSearch('');
      setSearchInput('');
      setView({ kind: 'list' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to send your message');
    } finally {
      setBusy(false);
    }
  }

  const pages = list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1;
  const onlySupport = contacts.length > 0 && contacts.every((contact) => contact.role === 'SUPPORT');
  const card = `${embedded ? 'rounded-xl' : 'rounded-lg'} border bg-white shadow-sm`;

  return (
    <div className={embedded ? '' : 'mx-auto max-w-6xl p-8'}>
      {!embedded && (
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">{title}</h1>
            <p className="mt-1 text-sm text-gray-600">{description}</p>
          </div>
          {backHref && (
            <a href={backHref} className="text-sm font-medium text-indigo-600 hover:underline">
              Back
            </a>
          )}
        </div>
      )}

      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {notice && <p className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</p>}

      <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
        {/* ── Folders and contacts ─────────────────────────────────────────── */}
        <aside className="space-y-6">
          <div className={card}>
            <div className="p-3">
              <button
                type="button"
                onClick={() => startCompose('')}
                className="w-full rounded-lg bg-purple-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-800"
              >
                Compose
              </button>
            </div>
            <nav className="border-t py-1" aria-label="Folders">
              {(['inbox', 'sent', 'trash'] as Folder[]).map((name) => {
                const count = name === 'inbox' ? summary.unread : name === 'trash' ? summary.trash : 0;
                const active = view.kind === 'list' && folder === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => goToFolder(name)}
                    className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                      active ? 'bg-purple-50 font-semibold text-purple-900' : 'text-gray-800'
                    }`}
                  >
                    <span>{FOLDER_LABELS[name]}</span>
                    {count > 0 && (
                      <span className={name === 'inbox' ? 'rounded-full bg-purple-700 px-2 py-0.5 text-xs font-semibold text-white' : 'text-xs text-gray-500'}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className={card}>
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-900">Contacts</h2>
              <p className="text-xs text-gray-500">Click a name to write to them.</p>
            </div>
            {contacts.length > SEARCH_THRESHOLD && (
              <div className="border-b p-3">
                <input
                  value={contactSearch}
                  onChange={(event) => setContactSearch(event.target.value)}
                  placeholder="Search contacts"
                  className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm"
                  aria-label="Search contacts"
                />
              </div>
            )}
            <ul className="max-h-72 divide-y overflow-y-auto">
              {visibleContacts.map((contact) => (
                <li key={contact.id}>
                  <button
                    type="button"
                    onClick={() => startCompose(contact.id)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-gray-50"
                  >
                    <span className="truncate text-sm font-medium text-gray-900">{contact.name}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                        contact.role === 'SUPPORT' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {roleLabel(contact.role)}
                    </span>
                  </button>
                </li>
              ))}
              {visibleContacts.length === 0 && <li className="p-4 text-sm text-gray-500">No contacts match.</li>}
            </ul>
            {onlySupport && (
              <p className="border-t px-4 py-3 text-xs text-gray-500">
                Advisors and clients are added to your contacts once you have spoken, booked a call or joined their callback line.
              </p>
            )}
          </div>
        </aside>

        {/* ── The folder list, a message, or the compose form ──────────────── */}
        <section className={card}>
          {view.kind === 'list' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                <h2 className="text-lg font-semibold text-gray-900">
                  {FOLDER_LABELS[folder]}
                  {list && <span className="ml-2 text-sm font-normal text-gray-500">{list.total} message{list.total === 1 ? '' : 's'}</span>}
                </h2>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    setPage(1);
                    setSearch(searchInput.trim());
                  }}
                  className="flex gap-2"
                >
                  <input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Search this folder"
                    aria-label="Search this folder"
                    className="w-48 rounded border border-gray-200 px-3 py-1.5 text-sm"
                  />
                  <button type="submit" className="rounded border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50">
                    Search
                  </button>
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchInput('');
                        setSearch('');
                        setPage(1);
                      }}
                      className="text-sm text-gray-500 underline"
                    >
                      Clear
                    </button>
                  )}
                </form>
              </div>

              {loading && !list ? (
                <p className="p-6 text-sm text-gray-500">Loading messages...</p>
              ) : list && list.messages.length === 0 ? (
                <p className="p-6 text-sm text-gray-500">
                  {search
                    ? 'No messages match your search.'
                    : folder === 'inbox'
                      ? 'Your inbox is empty.'
                      : folder === 'sent'
                        ? 'You have not sent any messages yet.'
                        : 'The trash is empty.'}
                </p>
              ) : (
                <ul className="divide-y">
                  {list?.messages.map((message) => {
                    // In the inbox the message is from someone else; in Sent it is to someone; in the trash it depends on which copy it is.
                    const other = message.fromMe ? message.to : message.from;
                    return (
                      <li key={message.id}>
                        <button
                          type="button"
                          onClick={() => void openMessage(message.id)}
                          className={`flex w-full items-start gap-4 px-4 py-3 text-left hover:bg-gray-50 ${message.unread ? 'bg-purple-50/40' : ''}`}
                        >
                          <span className="w-36 shrink-0 truncate text-sm">
                            <span className={message.unread ? 'font-bold text-gray-950' : 'text-gray-800'}>
                              {message.fromMe ? 'To: ' : ''}
                              {other.name}
                            </span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate text-sm ${message.unread ? 'font-bold text-gray-950' : 'text-gray-900'}`}>
                              {message.unread && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-purple-700 align-middle" aria-label="Unread" />}
                              {subjectOf(message.subject)}
                            </span>
                            <span className="block truncate text-xs text-gray-500">{message.snippet}</span>
                          </span>
                          <span className="shrink-0 text-xs text-gray-500">{shortDate(message.sentAt)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {list && pages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-3 py-1.5 disabled:opacity-40">
                    Newer
                  </button>
                  <span className="text-gray-600">
                    Page {list.page} of {pages}
                  </span>
                  <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded border px-3 py-1.5 disabled:opacity-40">
                    Older
                  </button>
                </div>
              )}
            </>
          )}

          {view.kind === 'message' && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                <button type="button" onClick={() => { setView({ kind: 'list' }); void loadList(); }} className="text-sm font-medium text-indigo-600 hover:underline">
                  ← Back to {FOLDER_LABELS[folder]}
                </button>
                {detail && (
                  <div className="flex flex-wrap gap-2">
                    {detail.message.folder !== 'trash' && (
                      <button
                        type="button"
                        onClick={() => startCompose((detail.message.fromMe ? detail.message.to : detail.message.from).id, { id: detail.message.id, subject: detail.message.subject })}
                        className="rounded bg-purple-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-800"
                      >
                        Reply
                      </button>
                    )}
                    {!detail.message.fromMe && detail.message.folder !== 'trash' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void act(`${detail.message.id}/unread`, 'PATCH', 'Marked as unread.')}
                        className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                      >
                        Mark unread
                      </button>
                    )}
                    {detail.message.folder === 'trash' ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void act(`${detail.message.id}/restore`, 'POST', 'The message was moved back.')}
                          className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                        >
                          Restore
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm('Delete this message for good? This cannot be undone.')) void act(`${detail.message.id}/purge`, 'POST', 'The message was deleted for good.');
                          }}
                          className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Delete forever
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void act(detail.message.id, 'DELETE', 'The message was moved to the trash.')}
                        className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>

              {!detail ? (
                <p className="p-6 text-sm text-gray-500">Opening message...</p>
              ) : (
                <div className="space-y-4 p-4">
                  <h2 className="text-xl font-semibold text-gray-950">{subjectOf(detail.message.subject)}</h2>
                  {detail.thread.length > 1 && <p className="text-xs text-gray-500">{detail.thread.length} messages in this conversation</p>}
                  {detail.thread.map((item) => (
                    <article
                      key={item.id}
                      className={`rounded-lg border p-4 ${item.id === detail.message.id ? 'border-purple-200 bg-white' : 'border-gray-200 bg-gray-50'}`}
                    >
                      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b pb-2 text-sm">
                        <div>
                          <span className="font-semibold text-gray-900">{item.fromMe ? 'You' : item.from.name}</span>
                          <span className="text-gray-500"> to </span>
                          <span className="text-gray-800">{item.fromMe ? item.to.name : 'you'}</span>
                        </div>
                        <time className="text-xs text-gray-500" dateTime={item.sentAt}>
                          {new Date(item.sentAt).toLocaleString()}
                        </time>
                      </header>
                      <p className="whitespace-pre-wrap text-sm text-gray-900">{item.body}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {view.kind === 'compose' && (
            <form onSubmit={send} className="space-y-4 p-4">
              <h2 className="text-lg font-semibold text-gray-900">{view.replyTo ? 'Reply' : 'New message'}</h2>

              <label className="block text-sm font-medium text-gray-700">
                To
                {view.replyTo ? (
                  <p className="mt-1 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
                    {contacts.find((contact) => contact.id === view.to)?.name ?? 'The sender'}
                  </p>
                ) : (
                  <select
                    value={view.to}
                    onChange={(event) => setView({ ...view, to: event.target.value })}
                    required
                    className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm"
                  >
                    <option value="">Choose a contact</option>
                    {contacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name} ({roleLabel(contact.role)})
                      </option>
                    ))}
                  </select>
                )}
              </label>

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
                  rows={10}
                  maxLength={5000}
                  required
                  className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm"
                />
              </label>

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-gray-500">{form.body.length}/5000</span>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setView({ kind: 'list' })} className="rounded border px-4 py-2 text-sm hover:bg-gray-50">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy || !view.to || !form.subject.trim() || !form.body.trim()}
                    className="rounded bg-purple-700 px-5 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50"
                  >
                    {busy ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

interface ClientEntry {
  id: string;
  name: string;
  listIds: string[];
}

interface CustomList {
  id: string;
  name: string;
  members: { id: string; name: string }[];
}

interface Overview {
  lists: CustomList[];
  clients: ClientEntry[];
}

interface SentGift {
  id: string;
  minutes: number;
  remaining: number;
  createdAt: string;
  to: string;
}

const GIFT_OPTIONS = [1, 3, 5];
const ALL = 'all';

async function readError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  if (Array.isArray(data?.message)) return data.message.join(' ');
  return data?.message ?? fallback;
}

async function call(path: string, method: string, body?: unknown): Promise<Response> {
  const res = await fetch(`/api/proxy/${path}`, {
    method,
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(await readError(res, 'That did not work'));
  return res;
}

/**
 * An advisor's clients (everyone who has spoken with, booked or queued with them), their own lists of those clients
 * ("Monday callers"), and gifts of free minutes.
 */
export function AdvisorClients() {
  const [data, setData] = useState<Overview | null>(null);
  const [gifts, setGifts] = useState<SentGift[]>([]);
  const [selected, setSelected] = useState<string>(ALL);
  const [search, setSearch] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);
  const [creatingName, setCreatingName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState({ subject: '', body: '' });
  const [giftFor, setGiftFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const [overview, sent] = await Promise.all([fetch('/api/proxy/contact-lists'), fetch('/api/proxy/free-minutes/sent')]);
      if (!overview.ok) throw new Error(await readError(overview, 'Unable to load your clients'));
      setData((await overview.json()) as Overview);
      if (sent.ok) setGifts((await sent.json()) as SentGift[]);
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load your clients');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeList = data?.lists.find((list) => list.id === selected) ?? null;

  const visibleClients = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    return data.clients
      .filter((client) => (activeList ? client.listIds.includes(activeList.id) : true))
      .filter((client) => (term ? client.name.toLowerCase().includes(term) : true));
  }, [data, activeList, search]);

  async function run(action: () => Promise<string | void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const done = await action();
      if (done) setNotice(done);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'That did not work');
    } finally {
      setBusy(false);
    }
  }

  const toggleMembership = (client: ClientEntry, list: CustomList) =>
    run(async () => {
      const onList = client.listIds.includes(list.id);
      await call(`contact-lists/${list.id}/members/${client.id}`, onList ? 'DELETE' : 'PUT');
      return onList ? `Removed ${client.name} from ${list.name}.` : `Added ${client.name} to ${list.name}.`;
    });

  const createList = (event: FormEvent, clientUserId?: string) => {
    event.preventDefault();
    const name = clientUserId ? newListName : creatingName;
    void run(async () => {
      await call('contact-lists', 'POST', { name, ...(clientUserId ? { clientUserId } : {}) });
      setNewListName('');
      setCreatingName('');
      setCreating(false);
      setMenuFor(null);
      return `Created ${name.trim()}.`;
    });
  };

  const rename = (event: FormEvent) => {
    event.preventDefault();
    if (!activeList) return;
    void run(async () => {
      await call(`contact-lists/${activeList.id}`, 'PATCH', { name: renameValue });
      setRenaming(false);
      return 'List renamed.';
    });
  };

  const deleteList = () => {
    if (!activeList) return;
    if (!window.confirm(`Delete the list "${activeList.name}"? The clients stay in your contacts.`)) return;
    void run(async () => {
      await call(`contact-lists/${activeList.id}`, 'DELETE');
      setSelected(ALL);
      return 'List deleted.';
    });
  };

  const sendToList = (event: FormEvent) => {
    event.preventDefault();
    if (!activeList) return;
    void run(async () => {
      const res = await call(`contact-lists/${activeList.id}/message`, 'POST', form);
      const result = (await res.json()) as { sent: number };
      setForm({ subject: '', body: '' });
      setComposing(false);
      return `Your message was sent to ${result.sent} client${result.sent === 1 ? '' : 's'} on ${activeList.name}.`;
    });
  };

  const sendGift = (client: ClientEntry, minutes: number) =>
    run(async () => {
      await call('free-minutes/gift', 'POST', { clientUserId: client.id, minutes });
      setGiftFor(null);
      return `Sent ${minutes} free minute${minutes === 1 ? '' : 's'} to ${client.name}.`;
    });

  if (loading) return <p className="text-sm text-gray-500">Loading your clients…</p>;

  const card = 'rounded-xl border bg-white shadow-sm';

  return (
    <div>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {notice && <p className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</p>}

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* ── Lists ─────────────────────────────────────────────────────────── */}
        <aside className={card}>
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Lists</h2>
            <p className="text-xs text-gray-500">Group clients, like the ones who call every Monday.</p>
          </div>
          <nav aria-label="Lists" className="py-1">
            <button
              type="button"
              onClick={() => { setSelected(ALL); setComposing(false); setRenaming(false); }}
              className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-50 ${selected === ALL ? 'bg-purple-50 font-semibold text-purple-900' : 'text-gray-800'}`}
            >
              <span>All clients</span>
              <span className="text-xs text-gray-500">{data?.clients.length ?? 0}</span>
            </button>
            {data?.lists.map((list) => (
              <button
                key={list.id}
                type="button"
                onClick={() => { setSelected(list.id); setComposing(false); setRenaming(false); }}
                className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50 ${selected === list.id ? 'bg-purple-50 font-semibold text-purple-900' : 'text-gray-800'}`}
              >
                <span className="truncate">{list.name}</span>
                <span className="text-xs text-gray-500">{list.members.length}</span>
              </button>
            ))}
          </nav>
          <div className="border-t p-3">
            {creating ? (
              <form onSubmit={(event) => createList(event)} className="space-y-2">
                <input
                  value={creatingName}
                  onChange={(event) => setCreatingName(event.target.value)}
                  placeholder="List name, e.g. Monday Callers"
                  maxLength={40}
                  autoFocus
                  className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm"
                  aria-label="New list name"
                />
                <div className="flex gap-2">
                  <button type="submit" disabled={busy || !creatingName.trim()} className="rounded bg-purple-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                    Create
                  </button>
                  <button type="button" onClick={() => setCreating(false)} className="rounded border px-3 py-1.5 text-xs">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button type="button" onClick={() => setCreating(true)} className="w-full rounded-lg border border-purple-500 px-3 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-50">
                New list
              </button>
            )}
          </div>
        </aside>

        {/* ── Clients ───────────────────────────────────────────────────────── */}
        <section className="space-y-6">
          <div className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
              <h2 className="text-lg font-semibold text-gray-900">{activeList ? activeList.name : 'All clients'}</h2>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search clients"
                className="rounded border border-gray-200 px-3 py-1.5 text-sm"
                aria-label="Search clients"
              />
            </div>

            {activeList && (
              <div className="space-y-3 border-b bg-gray-50 px-4 py-3">
                {renaming ? (
                  <form onSubmit={rename} className="flex flex-wrap gap-2">
                    <input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} maxLength={40} className="rounded border border-gray-200 px-3 py-1.5 text-sm" aria-label="List name" />
                    <button type="submit" disabled={busy || !renameValue.trim()} className="rounded bg-purple-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">Save</button>
                    <button type="button" onClick={() => setRenaming(false)} className="rounded border px-3 py-1.5 text-xs">Cancel</button>
                  </form>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setComposing((open) => !open)}
                      disabled={activeList.members.length === 0}
                      className="rounded bg-purple-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50"
                    >
                      Message everyone on this list
                    </button>
                    <button type="button" onClick={() => { setRenameValue(activeList.name); setRenaming(true); }} className="rounded border px-3 py-1.5 text-sm hover:bg-white">
                      Rename
                    </button>
                    <button type="button" onClick={deleteList} className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">
                      Delete list
                    </button>
                  </div>
                )}

                {composing && (
                  <form onSubmit={sendToList} className="space-y-3">
                    <p className="text-xs text-gray-500">
                      Each of the {activeList.members.length} client{activeList.members.length === 1 ? '' : 's'} on {activeList.name} gets their own copy.
                    </p>
                    <input
                      value={form.subject}
                      onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
                      placeholder="Subject"
                      maxLength={150}
                      required
                      className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
                      aria-label="Subject"
                    />
                    <textarea
                      value={form.body}
                      onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
                      placeholder="Message"
                      rows={5}
                      maxLength={5000}
                      required
                      className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
                      aria-label="Message"
                    />
                    <div className="flex gap-2">
                      <button type="submit" disabled={busy || !form.subject.trim() || !form.body.trim()} className="rounded bg-purple-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                        {busy ? 'Sending...' : 'Send'}
                      </button>
                      <button type="button" onClick={() => setComposing(false)} className="rounded border px-4 py-2 text-sm">Cancel</button>
                    </div>
                  </form>
                )}
              </div>
            )}

            <ul className="divide-y">
              {visibleClients.map((client) => (
                <li key={client.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">{client.name}</p>
                      {client.listIds.length > 0 && data && (
                        <p className="text-xs text-gray-500">
                          {client.listIds.map((id) => data.lists.find((list) => list.id === id)?.name).filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => { setMenuFor(menuFor === client.id ? null : client.id); setGiftFor(null); setNewListName(''); }}
                        className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                      >
                        {activeList ? 'Lists' : 'Add to list'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setGiftFor(giftFor === client.id ? null : client.id); setMenuFor(null); }}
                        className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                      >
                        Send free minutes
                      </button>
                      {activeList && (
                        <button type="button" onClick={() => void toggleMembership(client, activeList)} disabled={busy} className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">
                          Remove from list
                        </button>
                      )}
                    </div>
                  </div>

                  {menuFor === client.id && data && (
                    <div className="mt-3 rounded-lg border bg-gray-50 p-3">
                      {data.lists.length > 0 && (
                        <ul className="mb-3 space-y-1">
                          {data.lists.map((list) => (
                            <li key={list.id}>
                              <label className="flex items-center gap-2 text-sm text-gray-800">
                                <input type="checkbox" checked={client.listIds.includes(list.id)} disabled={busy} onChange={() => void toggleMembership(client, list)} />
                                {list.name}
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                      <form onSubmit={(event) => createList(event, client.id)} className="flex flex-wrap gap-2">
                        <input
                          value={newListName}
                          onChange={(event) => setNewListName(event.target.value)}
                          placeholder="Or start a new list, e.g. Monday Callers"
                          maxLength={40}
                          className="min-w-0 flex-1 rounded border border-gray-200 px-3 py-1.5 text-sm"
                          aria-label="New list name"
                        />
                        <button type="submit" disabled={busy || !newListName.trim()} className="rounded bg-purple-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                          Create and add
                        </button>
                      </form>
                    </div>
                  )}

                  {giftFor === client.id && (
                    <div className="mt-3 rounded-lg border bg-gray-50 p-3">
                      <p className="mb-2 text-sm text-gray-700">
                        Free minutes can only be used on calls with you, and last 30 days. You are not paid for them.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {GIFT_OPTIONS.map((minutes) => (
                          <button
                            key={minutes}
                            type="button"
                            disabled={busy}
                            onClick={() => void sendGift(client, minutes)}
                            className="rounded bg-purple-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50"
                          >
                            {minutes} minute{minutes === 1 ? '' : 's'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              ))}
              {visibleClients.length === 0 && (
                <li className="p-6 text-sm text-gray-500">
                  {data?.clients.length === 0
                    ? 'Clients appear here once they have spoken with you, booked a call or joined your callback line.'
                    : activeList && !search
                      ? 'This list is empty. Use "Add to list" on a client in All clients.'
                      : 'No clients match.'}
                </li>
              )}
            </ul>
          </div>

          {gifts.length > 0 && (
            <div className={card}>
              <div className="border-b px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-900">Free minutes you have sent</h2>
              </div>
              <ul className="divide-y">
                {gifts.map((gift) => (
                  <li key={gift.id} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
                    <span>
                      {gift.minutes} minute{gift.minutes === 1 ? '' : 's'} to <span className="font-medium">{gift.to}</span>
                    </span>
                    <span className="text-gray-500">
                      {gift.remaining === gift.minutes ? 'unused' : `${gift.remaining} left`} · {new Date(gift.createdAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

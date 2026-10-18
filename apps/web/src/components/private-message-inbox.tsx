'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

interface MessageUser {
  id: string;
  name: string;
  role: string;
}

interface PrivateMessage {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  sentAt: string;
  readAt: string | null;
  sender: MessageUser;
  recipient: MessageUser;
}

interface ConversationSummary {
  participant: MessageUser;
  lastMessage: PrivateMessage;
  unreadCount: number;
}

interface PrivateMessageInboxProps {
  title?: string;
  description?: string;
  backHref?: string;
  embedded?: boolean;
}

const ROLE_LABELS: Record<string, string> = { SUPPORT: 'Support', ADVISOR: 'Advisor', CLIENT: 'Client' };
const roleLabel = (role: string) => ROLE_LABELS[role] ?? role;

/** Contacts get a search box once the list is long enough to need one. */
const SEARCH_THRESHOLD = 8;

/**
 * Messages work like email: you write to Support and to the people you have been in contact with. The Contacts list is
 * your address book: Support is always at the top, and advisors or clients appear in it once you have been in touch.
 */
export function PrivateMessageInbox({
  title = 'Private Messages',
  description = 'Write to Support and to the advisors or clients you have been in contact with.',
  backHref,
  embedded = false,
}: PrivateMessageInboxProps) {
  const [contacts, setContacts] = useState<MessageUser[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [search, setSearch] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const selectedContact = useMemo(
    () =>
      contacts.find((contact) => contact.id === selectedUserId) ??
      conversations.find((conversation) => conversation.participant.id === selectedUserId)?.participant,
    [contacts, conversations, selectedUserId],
  );

  const visibleContacts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? contacts.filter((contact) => contact.name.toLowerCase().includes(term)) : contacts;
  }, [contacts, search]);

  const fetchOverview = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const [contactsRes, conversationsRes] = await Promise.all([
        fetch('/api/proxy/messages/contacts'),
        fetch('/api/proxy/messages/conversations'),
      ]);

      if (!contactsRes.ok) throw new Error('Unable to load your contacts');
      if (!conversationsRes.ok) throw new Error('Unable to load conversations');

      const nextContacts = (await contactsRes.json()) as MessageUser[];
      const nextConversations = (await conversationsRes.json()) as ConversationSummary[];
      setContacts(nextContacts);
      setConversations(nextConversations);

      if (!selectedUserId && nextConversations.length > 0) {
        setSelectedUserId(nextConversations[0].participant.id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading messages');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [selectedUserId]);

  const fetchThread = useCallback(async (participantId: string) => {
    if (!participantId) {
      setMessages([]);
      return;
    }

    setThreadLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/proxy/messages/conversations/${participantId}`);
      if (!res.ok) throw new Error('Unable to load this conversation');
      setMessages((await res.json()) as PrivateMessage[]);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.participant.id === participantId
            ? { ...conversation, unreadCount: 0 }
            : conversation,
        ),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading conversation');
    } finally {
      setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    void fetchThread(selectedUserId);
  }, [fetchThread, selectedUserId]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUserId || !body.trim()) return;

    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/proxy/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: selectedUserId, body }),
      });

      if (!res.ok) {
        const responseBody = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(responseBody?.message ?? 'Unable to send message');
      }

      setBody('');
      await fetchThread(selectedUserId);
      await fetchOverview(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error sending message');
    } finally {
      setSending(false);
    }
  }

  const onlySupport = contacts.length > 0 && contacts.every((contact) => contact.role === 'SUPPORT');

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

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-6">
          <div className={`${embedded ? 'rounded-xl' : 'rounded-lg'} border bg-white shadow-sm`}>
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-900">Conversations</h2>
            </div>
            {loading ? (
              <p className="p-4 text-sm text-gray-500">Loading messages...</p>
            ) : conversations.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">No conversations yet. Choose a contact to start one.</p>
            ) : (
              <div className="divide-y">
                {conversations.map((conversation) => (
                  <button
                    key={conversation.participant.id}
                    type="button"
                    onClick={() => setSelectedUserId(conversation.participant.id)}
                    className={`block w-full px-4 py-3 text-left hover:bg-gray-50 ${
                      selectedUserId === conversation.participant.id ? 'bg-purple-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-gray-900">{conversation.participant.name}</div>
                        <div className="text-xs text-gray-500">{roleLabel(conversation.participant.role)}</div>
                      </div>
                      {conversation.unreadCount > 0 && (
                        <span className="rounded-full bg-purple-700 px-2 py-0.5 text-xs font-semibold text-white">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-gray-500">
                      {conversation.lastMessage.body}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={`${embedded ? 'rounded-xl' : 'rounded-lg'} border bg-white shadow-sm`}>
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-900">Contacts</h2>
              <p className="text-xs text-gray-500">The people you can write to.</p>
            </div>
            {contacts.length > SEARCH_THRESHOLD && (
              <div className="border-b p-3">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search contacts"
                  className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm"
                  aria-label="Search contacts"
                />
              </div>
            )}
            {loading ? (
              <p className="p-4 text-sm text-gray-500">Loading contacts...</p>
            ) : (
              <>
                <ul className="max-h-80 divide-y overflow-y-auto">
                  {visibleContacts.map((contact) => (
                    <li key={contact.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedUserId(contact.id)}
                        className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-gray-50 ${
                          selectedUserId === contact.id ? 'bg-purple-50' : ''
                        }`}
                      >
                        <span className="font-medium text-gray-900">{contact.name}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
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
              </>
            )}
          </div>
        </aside>

        <section className={`${embedded ? 'rounded-xl' : 'rounded-lg'} border bg-white shadow-sm`}>
          <div className="border-b px-4 py-3">
            {selectedContact ? (
              <>
                <h2 className="text-lg font-semibold text-gray-900">{selectedContact.name}</h2>
                <p className="text-xs text-gray-500">{roleLabel(selectedContact.role)}</p>
              </>
            ) : (
              <p className="text-sm text-gray-500">Choose a contact to read or write a message.</p>
            )}
          </div>

          <div className="min-h-[360px] space-y-3 p-4">
            {threadLoading ? (
              <p className="text-sm text-gray-500">Loading conversation...</p>
            ) : !selectedUserId ? (
              <p className="text-sm text-gray-500">Choose a contact to start a message.</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-gray-500">No messages yet. Write the first one below.</p>
            ) : (
              messages.map((message) => {
                const sentBySelectedUser = message.senderId === selectedUserId;
                return (
                  <div
                    key={message.id}
                    className={`flex ${sentBySelectedUser ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-lg px-4 py-3 text-sm ${
                        sentBySelectedUser
                          ? 'bg-gray-100 text-gray-900'
                          : 'bg-purple-700 text-white'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.body}</p>
                      <p
                        className={`mt-2 text-xs ${
                          sentBySelectedUser ? 'text-gray-500' : 'text-purple-100'
                        }`}
                      >
                        {new Date(message.sentAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={handleSend} className="border-t p-4">
            <label className="block text-sm font-medium text-gray-700">
              {selectedContact ? `Message to ${selectedContact.name}` : 'New message'}
            </label>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={4}
              maxLength={5000}
              disabled={!selectedUserId}
              placeholder={selectedUserId ? 'Write a message...' : 'Choose a contact first'}
              className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-gray-500">{body.length}/5000</span>
              <button
                type="submit"
                disabled={!selectedUserId || !body.trim() || sending}
                className="rounded bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

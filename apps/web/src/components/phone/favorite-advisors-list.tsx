'use client';

import { useCallback, useEffect, useState } from 'react';
import { FAVORITES_CHANGED_EVENT } from './phone-client';
import { formatDollars, readMessage, toCents } from './phone-format';

interface FavoriteCard {
  id: string;
  slug: string;
  displayName: string;
  profileImageUrl: string | null;
  ratePerMinute: number | string;
  isOnline: boolean;
  busy: boolean;
  queueLength: number;
}

const REFRESH_INTERVAL_MS = 20_000;

function statusOf(card: FavoriteCard) {
  const waiting = card.queueLength > 0 ? ` · ${card.queueLength} waiting` : '';
  if (!card.isOnline) return { text: `Offline${waiting}`, dot: 'bg-gray-400', color: 'text-gray-500' };
  if (card.busy) return { text: `On another call${waiting}`, dot: 'bg-amber-500', color: 'text-amber-700' };
  return { text: 'Available now', dot: 'bg-green-500', color: 'text-green-700' };
}

/**
 * The signed-in client's favourite advisors with their status, including the ones who are offline (open their
 * page to request a callback). `page` is the full list in the dashboard, with a remove button; `strip` is a compact
 * row on the readings page that only appears when there is something to show.
 */
export function FavoriteAdvisorsList({ variant, primaryColor }: { variant: 'page' | 'strip'; primaryColor?: string }) {
  const [cards, setCards] = useState<FavoriteCard[] | null>(null);
  const [visible, setVisible] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const accent = primaryColor ?? '#6f21b6';

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/phone/favorites');
      // Visitors and advisors have no favourites list.
      if (res.status === 401 || res.status === 403) return setVisible(false);
      if (!res.ok) throw new Error(await readMessage(res, 'Could not load your favorite advisors'));
      setCards((await res.json()) as FavoriteCard[]);
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load your favorite advisors');
      setCards((current) => current ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = setInterval(() => void load(), REFRESH_INTERVAL_MS);
    window.addEventListener(FAVORITES_CHANGED_EVENT, load);
    return () => {
      clearInterval(refresh);
      window.removeEventListener(FAVORITES_CHANGED_EVENT, load);
    };
  }, [load]);

  async function remove(card: FavoriteCard) {
    setBusyId(card.id);
    setError('');
    try {
      const res = await fetch(`/api/proxy/phone/advisors/${encodeURIComponent(card.slug)}/favorite`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readMessage(res, 'Could not remove this advisor'));
      setCards((current) => (current ?? []).filter((other) => other.id !== card.id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not remove this advisor');
    } finally {
      setBusyId(null);
    }
  }

  if (!visible) return null;
  if (variant === 'strip' && (cards === null || cards.length === 0)) return null;

  return (
    <section className={variant === 'strip' ? 'mb-8' : ''} aria-label="Favorite advisors">
      {variant === 'strip' && <h2 className="mb-3 text-lg font-semibold text-gray-950">Your favorite advisors</h2>}

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {cards === null && <p className="text-sm text-gray-500">Loading…</p>}

      {cards !== null && cards.length === 0 && variant === 'page' && (
        <p className="text-sm text-gray-600">
          You have not saved any advisors yet. Open an advisor&apos;s page and press <span className="font-medium">Add to favorites</span> to
          keep them here, even when they are offline.{' '}
          <a href="/phone-readings" className="font-medium underline" style={{ color: accent }}>
            Find an advisor
          </a>
        </p>
      )}

      {cards !== null && cards.length > 0 && (
        <ul className={variant === 'strip' ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3' : 'grid gap-4 sm:grid-cols-2'}>
          {cards.map((card) => {
            const status = statusOf(card);
            const showImage = card.profileImageUrl && /^(https?:)?\//.test(card.profileImageUrl);
            return (
              <li key={card.id} className="flex items-center gap-4 rounded-xl border bg-white p-4 shadow-sm">
                <a href={`/advisors/${card.slug}`} className="shrink-0" aria-label={`View ${card.displayName}'s page`}>
                  {showImage ? (
                    <img src={card.profileImageUrl ?? ''} alt="" className="h-14 w-14 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-semibold text-white" style={{ backgroundColor: accent }}>
                      {card.displayName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </a>
                <div className="min-w-0 flex-1">
                  <a href={`/advisors/${card.slug}`} className="block truncate font-semibold text-gray-900 hover:underline">
                    {card.displayName}
                  </a>
                  <p className="text-sm text-gray-600">{formatDollars(toCents(card.ratePerMinute))} / min</p>
                  <p className={`inline-flex items-center gap-1 text-xs font-medium ${status.color}`}>
                    <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                    {status.text}
                  </p>
                  <div className="mt-1 flex gap-3 text-sm">
                    <a href={`/advisors/${card.slug}`} className="font-medium underline" style={{ color: accent }}>
                      {card.isOnline ? 'View page' : 'View page, request a callback'}
                    </a>
                    {variant === 'page' && (
                      <button
                        type="button"
                        onClick={() => void remove(card)}
                        disabled={busyId === card.id}
                        className="text-gray-500 underline hover:text-gray-800 disabled:opacity-50"
                      >
                        {busyId === card.id ? 'Removing…' : 'Remove'}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

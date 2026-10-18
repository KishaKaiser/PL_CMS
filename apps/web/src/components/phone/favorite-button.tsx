'use client';

import { useEffect, useState } from 'react';
import { FAVORITES_CHANGED_EVENT, loginUrl } from './phone-client';
import { readMessage } from './phone-format';

type State = 'loading' | 'signed-out' | 'hidden' | 'ready';

/** Adds an advisor to the signed-in client's favourites, or removes them. Shown on the advisor's own page. */
export function FavoriteButton({ slug, primaryColor }: { slug: string; primaryColor: string }) {
  const [state, setState] = useState<State>('loading');
  const [favorite, setFavorite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/proxy/phone/advisors/${encodeURIComponent(slug)}/favorite`)
      .then(async (res) => {
        // Not signed in is a normal state for visitors; any other account (an advisor, an admin) just does not see this.
        if (res.status === 401) return setState('signed-out');
        if (!res.ok) return setState('hidden');
        setFavorite(((await res.json()) as { favorite: boolean }).favorite);
        setState('ready');
      })
      .catch(() => setState('hidden'));
  }, [slug]);

  async function toggle() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/proxy/phone/advisors/${encodeURIComponent(slug)}/favorite`, {
        method: favorite ? 'DELETE' : 'PUT',
      });
      if (!res.ok) throw new Error(await readMessage(res, 'Could not update your favorites'));
      setFavorite(((await res.json()) as { favorite: boolean }).favorite);
      window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update your favorites');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading' || state === 'hidden') return null;

  if (state === 'signed-out') {
    return (
      <p className="mt-3 text-sm text-gray-600">
        <a href={loginUrl(`/advisors/${slug}`)} className="font-medium underline" style={{ color: primaryColor }}>
          Sign in
        </a>{' '}
        to save this advisor to your favorites.
      </p>
    );
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        aria-pressed={favorite}
        className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition hover:bg-gray-50 disabled:opacity-60"
        style={favorite ? { borderColor: primaryColor, color: primaryColor } : undefined}
      >
        <span aria-hidden="true" className="text-base leading-none">
          {favorite ? '♥' : '♡'}
        </span>
        {busy ? 'Saving…' : favorite ? 'In your favorites (remove)' : 'Add to favorites'}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';

interface ReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  hidden: boolean;
  hiddenAt: string | null;
  hiddenReason: string | null;
  advisor: { id: string; displayName: string; slug: string | null };
  user: { id: string; username: string | null; name: string; email: string };
}

interface ReviewList {
  counts: { total: number; hidden: number; visible: number };
  reviews: ReviewRow[];
}

interface AdvisorOption {
  id: string;
  displayName: string;
}

type StatusFilter = 'all' | 'visible' | 'hidden';

async function readMessage(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
  if (Array.isArray(data.message)) return data.message.join(' ');
  return data.message ?? fallback;
}

function Stars({ value }: { value: number }) {
  return (
    <span aria-label={`${value} out of 5 stars`} className="whitespace-nowrap text-amber-500">
      {'★'.repeat(value)}
      <span className="text-gray-300">{'★'.repeat(5 - value)}</span>
    </span>
  );
}

export default function AdminReviewsPage() {
  const [data, setData] = useState<ReviewList | null>(null);
  const [advisors, setAdvisors] = useState<AdvisorOption[]>([]);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [advisorId, setAdvisorId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      if (advisorId) params.set('advisorId', advisorId);
      if (search) params.set('search', search);
      const res = await fetch(`/api/proxy/admin/reviews?${params.toString()}`);
      if (!res.ok) throw new Error(await readMessage(res, `Could not load reviews (HTTP ${res.status}).`));
      setData((await res.json()) as ReviewList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load reviews.');
    } finally {
      setLoading(false);
    }
  }, [status, advisorId, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    fetch('/api/proxy/admin/reviews/advisors')
      .then((res) => (res.ok ? (res.json() as Promise<AdvisorOption[]>) : []))
      .then(setAdvisors)
      .catch(() => setAdvisors([]));
  }, []);

  async function setHidden(review: ReviewRow, hidden: boolean) {
    let reason: string | undefined;
    if (hidden) {
      const answer = window.prompt('Why are you hiding this review? Only admins see this note. (Optional)', review.hiddenReason ?? '');
      if (answer === null) return; // cancelled
      reason = answer.trim() || undefined;
    }

    setBusyId(review.id);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/proxy/admin/reviews/${review.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hidden, reason }),
      });
      if (!res.ok) throw new Error(await readMessage(res, 'Could not update the review.'));
      setMessage(hidden ? 'Review hidden from the public profile and the advisor’s average.' : 'Review is visible again.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the review.');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(review: ReviewRow) {
    const who = review.user.username ?? review.user.email;
    if (!window.confirm(`Permanently delete ${who}'s review of ${review.advisor.displayName}? This cannot be undone.`)) return;

    setBusyId(review.id);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/proxy/admin/reviews/${review.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readMessage(res, 'Could not delete the review.'));
      setMessage('Review deleted.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the review.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-gray-950">Advisor reviews</h1>
          <p className="mt-2 text-sm text-gray-600">
            Moderate the star ratings and comments clients leave for advisors. A hidden review disappears from the advisor&apos;s
            public profile and no longer counts toward their average, but you can show it again later. Deleting is permanent and lets
            that client write a new review. Every action is recorded in the audit log.
          </p>
          {data && (
            <p className="mt-2 text-sm text-gray-500">
              {data.counts.total} total · {data.counts.visible} visible · {data.counts.hidden} hidden
            </p>
          )}
        </header>

        <form
          className="flex flex-wrap items-end gap-3 rounded border border-gray-200 bg-white p-4"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(searchInput.trim());
          }}
        >
          <label className="text-sm font-medium text-gray-700">
            Show
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
              className="mt-1 block rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="all">All reviews</option>
              <option value="visible">Visible only</option>
              <option value="hidden">Hidden only</option>
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">
            Advisor
            <select
              value={advisorId}
              onChange={(event) => setAdvisorId(event.target.value)}
              className="mt-1 block rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All advisors</option>
              {advisors.map((advisor) => (
                <option key={advisor.id} value={advisor.id}>
                  {advisor.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[14rem] flex-1 text-sm font-medium text-gray-700">
            Search
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Comment, username, email or advisor"
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <button type="submit" className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Search
          </button>
        </form>

        {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {message && <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

        {loading && !data ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : data && data.reviews.length === 0 ? (
          <p className="text-sm text-gray-500">No reviews match.</p>
        ) : (
          <ul className="space-y-3">
            {data?.reviews.map((review) => (
              <li
                key={review.id}
                className={`rounded border bg-white p-4 ${review.hidden ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Stars value={review.rating} />
                      <span className="font-medium text-gray-950">{review.advisor.displayName}</span>
                      {review.hidden && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Hidden</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      By <span className="font-medium text-gray-700">{review.user.username ?? 'no username'}</span> ({review.user.name},{' '}
                      {review.user.email}) · {new Date(review.createdAt).toLocaleString()}
                      {review.updatedAt !== review.createdAt && ` · edited ${new Date(review.updatedAt).toLocaleString()}`}
                    </p>
                    {review.comment ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{review.comment}</p>
                    ) : (
                      <p className="mt-2 text-sm italic text-gray-400">No comment, rating only.</p>
                    )}
                    {review.hidden && review.hiddenReason && (
                      <p className="mt-2 text-xs text-amber-800">Hidden because: {review.hiddenReason}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={busyId === review.id}
                      onClick={() => void setHidden(review, !review.hidden)}
                      className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                    >
                      {review.hidden ? 'Show' : 'Hide'}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === review.id}
                      onClick={() => void remove(review)}
                      className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {data && data.reviews.length >= 200 && (
          <p className="text-xs text-gray-500">Showing the newest 200. Use the filters to narrow the list.</p>
        )}
      </div>
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { loginUrl } from './phone-client';
import { readMessage } from './phone-format';

type Access = 'loading' | 'signed-out' | 'not-a-client' | 'not-eligible' | 'eligible';

/** Lets a client who has spoken with the advisor leave a star rating and comment. A posted review cannot be changed. */
export function ReviewForm({ slug, advisorName, primaryColor }: { slug: string; advisorName: string; primaryColor: string }) {
  const router = useRouter();
  const [access, setAccess] = useState<Access>('loading');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  // The review the client already posted; it is shown read-only because reviews cannot be changed.
  const [posted, setPosted] = useState<{ rating: number; comment: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/proxy/phone/advisors/${encodeURIComponent(slug)}/my-review`)
      .then(async (res) => {
        if (res.status === 401) return setAccess('signed-out');
        if (!res.ok) return setAccess('not-a-client');
        const data = (await res.json()) as { eligible: boolean; review: { rating: number; comment: string | null } | null };
        if (!data.eligible) return setAccess('not-eligible');
        if (data.review) setPosted(data.review);
        setAccess('eligible');
      })
      .catch(() => setAccess('not-a-client'));
  }, [slug]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (rating < 1) {
      setError('Choose a star rating.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/proxy/phone/advisors/${encodeURIComponent(slug)}/review`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rating, comment }),
      });
      if (!res.ok) throw new Error(await readMessage(res, 'Could not save your review'));
      setPosted({ rating, comment: comment.trim() || null });
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save your review');
    } finally {
      setSaving(false);
    }
  }

  if (access === 'loading' || access === 'not-a-client') return null;

  if (access === 'signed-out') {
    return (
      <p className="mb-6 text-sm text-gray-600">
        <a href={loginUrl(`/advisors/${slug}`)} className="font-medium underline" style={{ color: primaryColor }}>
          Sign in
        </a>{' '}
        to leave a review after you have spoken with {advisorName}.
      </p>
    );
  }

  if (access === 'not-eligible') {
    return <p className="mb-6 text-sm text-gray-500">You can leave a review once you have spoken with {advisorName}.</p>;
  }

  if (posted) {
    return (
      <div id="review" className="mb-8 rounded-lg border bg-gray-50 p-4">
        <h3 className="font-semibold text-gray-900">Your review</h3>
        <p className="mt-2 text-2xl leading-none" aria-label={`${posted.rating} out of 5 stars`}>
          <span className="text-amber-500">{'★'.repeat(posted.rating)}</span>
          <span className="text-gray-300">{'★'.repeat(5 - posted.rating)}</span>
        </p>
        {posted.comment && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{posted.comment}</p>}
        <p className="mt-3 text-xs text-gray-500">Thank you for your review. Reviews cannot be changed once they are posted.</p>
      </div>
    );
  }

  return (
    <form id="review" onSubmit={handleSubmit} className="mb-8 rounded-lg border bg-gray-50 p-4">
      <h3 className="font-semibold text-gray-900">{`How was your call with ${advisorName}?`}</h3>

      <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Star rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={rating === star}
            aria-label={`${star} star${star === 1 ? '' : 's'}`}
            onClick={() => setRating(star)}
            className={`text-3xl leading-none ${star <= rating ? 'text-amber-500' : 'text-gray-300'} hover:text-amber-400`}
          >
            ★
          </button>
        ))}
      </div>

      <label className="mt-3 block text-sm font-medium text-gray-700">
        Comment (optional)
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={3}
          maxLength={1000}
          className="mt-1 w-full rounded border px-3 py-2 text-sm"
          placeholder="Share what the reading was like."
        />
      </label>

      <p className="mt-1 text-xs text-gray-500">
        Your username is shown with your review. You cannot change a review after posting it, so please check it first.
      </p>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="mt-3 rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        style={{ backgroundColor: primaryColor }}
      >
        {saving ? 'Posting…' : 'Post review'}
      </button>
    </form>
  );
}

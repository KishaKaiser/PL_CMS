'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: {
    id: string;
    username?: string | null;
    name: string;
  };
}

type Props = {
  title: string;
  endpoint: string;
  loginMessage?: string;
};

export function ReviewSection({ title, endpoint, loginMessage = 'Log in to leave a rating.' }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(endpoint)
      .then((response) => (response.ok ? response.json() : []))
      .then((data: Review[]) => {
        if (active) setReviews(data);
      })
      .catch(() => {
        if (active) setReviews([]);
      });
    return () => {
      active = false;
    };
  }, [endpoint]);

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    return reviews.reduce((total, review) => total + review.rating, 0) / reviews.length;
  }, [reviews]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    setError('');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment }),
      });

      if (response.status === 401) throw new Error(loginMessage);
      if (response.status === 403) throw new Error('You are not eligible to review this item yet.');
      if (!response.ok) throw new Error('Could not save your review.');

      const saved = (await response.json()) as Review;
      setReviews((currentReviews) => [saved, ...currentReviews.filter((review) => review.id !== saved.id)]);
      setComment('');
      setNotice('Your review was saved.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save your review.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-10 border-t pt-8">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-gray-500">
            {reviews.length === 0 ? 'No ratings yet.' : `${averageRating.toFixed(1)} out of 5 from ${reviews.length} review${reviews.length === 1 ? '' : 's'}.`}
          </p>
        </div>
        <div className="text-lg text-yellow-500">{renderStars(Math.round(averageRating || 0))}</div>
      </div>

      <form onSubmit={handleSubmit} className="mb-6 rounded-lg border bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
          <label className="block text-sm font-medium text-gray-700">
            Rating
            <select
              value={rating}
              onChange={(event) => setRating(Number(event.target.value))}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            >
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>{value} star{value === 1 ? '' : 's'}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Comment
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              placeholder="Share your experience"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="mt-3 rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Review'}
        </button>
        {notice && <p className="mt-2 text-sm text-green-700">{notice}</p>}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </form>

      <div className="space-y-3">
        {reviews.map((review) => (
          <article key={review.id} className="rounded-lg border bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{review.user.username || review.user.name}</p>
              <span className="text-sm text-yellow-500">{renderStars(review.rating)}</span>
            </div>
            {review.comment && <p className="mt-2 text-sm text-gray-600">{review.comment}</p>}
            <p className="mt-2 text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString()}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function renderStars(rating: number) {
  return '★★★★★'.slice(0, rating) + '☆☆☆☆☆'.slice(0, Math.max(0, 5 - rating));
}

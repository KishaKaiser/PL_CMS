'use client';

import { FormEvent, useEffect, useState } from 'react';
import { slugify } from '../../../../lib/cms';

const TRANSIT_TYPES = [
  { value: 'mercury-retrograde', label: 'Mercury Retrograde', description: 'Communication, technology, and travel disruptions' },
  { value: 'venus-retrograde', label: 'Venus Retrograde', description: 'Love, relationships, and values review' },
  { value: 'mars-retrograde', label: 'Mars Retrograde', description: 'Energy, motivation, and action reassessment' },
  { value: 'jupiter-transit', label: 'Jupiter Transit', description: 'Growth, expansion, and opportunities' },
  { value: 'saturn-transit', label: 'Saturn Transit', description: 'Responsibility, structure, and life lessons' },
  { value: 'uranus-transit', label: 'Uranus Transit', description: 'Change, innovation, and breakthroughs' },
  { value: 'neptune-transit', label: 'Neptune Transit', description: 'Dreams, spirituality, and illusions' },
  { value: 'pluto-transit', label: 'Pluto Transit', description: 'Transformation, power, and deep change' },
  { value: 'solar-eclipse', label: 'Solar Eclipse', description: 'New beginnings and powerful initiations' },
  { value: 'lunar-eclipse', label: 'Lunar Eclipse', description: 'Endings, revelations, and emotional releases' },
  { value: 'new-moon', label: 'New Moon', description: 'Fresh starts and setting intentions' },
  { value: 'full-moon', label: 'Full Moon', description: 'Culmination, completion, and illumination' },
];

type Author = { id: string; name: string; email: string };

export default function AstrologyBlogPage() {
  const [transitType, setTransitType] = useState(TRANSIT_TYPES[0].value);
  const [additionalContext, setAdditionalContext] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [slug, setSlug] = useState('');
  const [authors, setAuthors] = useState<Author[]>([]);
  const [authorId, setAuthorId] = useState('');
  const [publishNow, setPublishNow] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    fetch('/api/proxy/users')
      .then((res) => res.json())
      .then((data: Author[]) => {
        setAuthors(data);
        if (data[0]) setAuthorId(data[0].id);
      })
      .catch(() => undefined);
  }, []);

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGenerating(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/proxy/astrology/blog/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transitType, additionalContext: additionalContext.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Blog post could not be generated.');
      setTitle(data.title);
      setContent(data.content);
      setSlug(slugify(data.title));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Blog post could not be generated.');
    } finally {
      setGenerating(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    setError('');
    setMessage('');

    try {
      if (!authorId) throw new Error('Choose an author before publishing.');
      const res = await fetch('/api/proxy/astrology/blog/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          slug: slugify(slug || title),
          authorId,
          publishedAt: publishNow ? new Date().toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Blog post could not be published.');
      setMessage(publishNow ? 'Blog post published.' : 'Blog post saved as a draft.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Blog post could not be published.');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">Astrology Module</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-950">Blog Post Generator</h1>
          <p className="mt-2 text-sm text-gray-600">Generate an AI-written blog post about an astrological transit and publish it to the CMS blog.</p>
          <p className="mt-2 text-xs text-gray-500">
            Recurring/scheduled generation isn&apos;t available yet — this deployment has no background job runner. Generate posts on demand for now.
          </p>
        </header>

        {(error || message) && (
          <div className={`rounded border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
            {error || message}
          </div>
        )}

        <form onSubmit={handleGenerate} className="space-y-4 rounded border border-gray-200 bg-white p-5">
          <label className="block text-sm font-medium text-gray-700">
            Transit Type
            <select value={transitType} onChange={(e) => setTransitType(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm">
              {TRANSIT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label} — {type.description}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Additional Context (optional)
            <textarea value={additionalContext} onChange={(e) => setAdditionalContext(e.target.value)} rows={3} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" placeholder="Any specific themes, zodiac signs, or focus areas to include" />
          </label>
          <button disabled={generating} className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-400">
            {generating ? 'Generating...' : 'Generate Blog Post'}
          </button>
        </form>

        {(title || content) && (
          <section className="space-y-4 rounded border border-gray-200 bg-white p-5">
            <label className="block text-sm font-medium text-gray-700">
              Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Slug
              <input value={slug} onChange={(e) => setSlug(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono" />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Content
              <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={16} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Author
              <select value={authorId} onChange={(e) => setAuthorId(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm">
                {authors.map((author) => (
                  <option key={author.id} value={author.id}>{author.name} ({author.email})</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} />
              Publish immediately (unchecked = save as draft)
            </label>
            <button onClick={handlePublish} disabled={publishing} className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-400">
              {publishing ? 'Publishing...' : publishNow ? 'Publish to Blog' : 'Save as Draft'}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

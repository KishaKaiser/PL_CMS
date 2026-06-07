'use client';

import {
  type EditorialStatus,
  getEditorialStatusBadgeClass,
  getEditorialStatusLabel,
  toPlainText,
} from '../../lib/cms';

interface Props {
  title: string;
  excerpt?: string;
  content: string;
  featuredImageUrl?: string;
  permalink: string;
  status: EditorialStatus;
  publishedAt?: string | null;
  authorName?: string;
}

export function EditorPreview({
  title,
  excerpt,
  content,
  featuredImageUrl,
  permalink,
  status,
  publishedAt,
  authorName,
}: Props) {
  const contentPreview = toPlainText(content);

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-900">Live Preview</h3>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getEditorialStatusBadgeClass(status)}`}>
            {getEditorialStatusLabel(status)}
          </span>
        </div>
        <p className="mt-2 text-xs text-gray-500">{permalink || 'Add a slug to preview the URL.'}</p>
        {publishedAt && (
          <p className="mt-1 text-xs text-gray-500">
            {status === 'scheduled' ? 'Scheduled for' : 'Publish date'} {new Date(publishedAt).toLocaleString()}
          </p>
        )}
      </div>

      {featuredImageUrl && (
        <img src={featuredImageUrl} alt={title || 'Featured image preview'} className="h-48 w-full object-cover" />
      )}

      <div className="space-y-4 px-4 py-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{title || 'Untitled content'}</h2>
          {authorName && <p className="mt-1 text-sm text-gray-500">By {authorName}</p>}
          {excerpt && <p className="mt-3 text-sm text-gray-600">{excerpt}</p>}
        </div>

        {contentPreview ? (
          <p className="whitespace-pre-wrap text-sm text-gray-700">{contentPreview}</p>
        ) : (
          <p className="text-sm text-gray-500">Your visual editor is the best preview for formatting while you write.</p>
        )}
      </div>
    </section>
  );
}

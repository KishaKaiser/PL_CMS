'use client';

import { useState } from 'react';
import { PdfViewer } from './cms/pdf-viewer';

function formatBytes(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** The product's instructions PDF on its page: read them right here, or download the file. */
export function ProductInstructions({ url, title, sizeBytes }: { url: string; title: string; sizeBytes?: number }) {
  const [open, setOpen] = useState(false);
  const downloadUrl = `${url}${url.includes('?') ? '&' : '?'}download=1`;

  return (
    <section className="mt-8 rounded-lg border bg-white shadow-sm" aria-labelledby="product-instructions-heading">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="product-instructions-heading" className="text-xl font-semibold text-gray-950">Product Instructions</h2>
          <p className="mt-1 text-sm text-gray-600">
            {title} (PDF{sizeBytes ? `, ${formatBytes(sizeBytes)}` : ''})
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
          >
            {open ? 'Hide instructions' : 'View instructions'}
          </button>
          <a href={downloadUrl} download className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Download PDF
          </a>
        </div>
      </div>
      {open && (
        <div className="border-t border-gray-100 p-5 pb-0">
          <PdfViewer src={url} title={title} height={720} showDownload={false} />
        </div>
      )}
    </section>
  );
}

'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

export interface MediaAsset {
  id: string;
  originalName: string;
  title: string;
  altText: string | null;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
  url: string;
  isImage: boolean;
}

type Props = {
  title?: string;
  description?: string;
  selectedMediaId?: string | null;
  onSelect?: (asset: MediaAsset) => void;
  onInsert?: (asset: MediaAsset) => void;
  onlyImages?: boolean;
};

const ACCEPTED_UPLOAD_TYPES = 'image/jpeg,image/png,image/gif,image/webp,application/pdf';

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildMediaEmbedHtml(asset: MediaAsset) {
  const label = escapeHtml(asset.altText || asset.title || asset.originalName);
  const url = escapeHtml(asset.url);

  if (asset.isImage) {
    return `<p><img src="${url}" alt="${label}" /></p>`;
  }

  return `<p><a href="${url}">${label}</a></p>`;
}

export function MediaLibrary({
  title = 'Media Library',
  description = 'Upload and reuse shared media across admin workflows.',
  selectedMediaId = null,
  onSelect,
  onInsert,
  onlyImages = false,
}: Props) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadAltText, setUploadAltText] = useState('');

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/proxy/media');
      if (!response.ok) throw new Error('Failed to load media library.');
      setAssets((await response.json()) as MediaAsset[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load media library.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAssets();
  }, [fetchAssets]);

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return assets;
    return assets.filter((asset) =>
      [asset.title, asset.originalName, asset.altText ?? '', asset.mimeType].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [assets, search]);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uploadFile) {
      setError('Choose a file to upload.');
      return;
    }

    setUploading(true);
    setError('');
    setNotice('');

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      if (uploadTitle.trim()) formData.append('title', uploadTitle.trim());
      if (uploadAltText.trim()) formData.append('altText', uploadAltText.trim());

      const response = await fetch('/api/proxy/media', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? 'Upload failed.');
      }

      const created = (await response.json()) as MediaAsset;
      setAssets((currentAssets) => [created, ...currentAssets]);
      setUploadFile(null);
      setUploadTitle('');
      setUploadAltText('');
      setNotice(`Uploaded ${created.title}.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleCopyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setNotice('Media URL copied to clipboard.');
    } catch {
      window.prompt('Copy media URL', url);
    }
  }

  async function handleDelete(asset: MediaAsset) {
    const confirmed = window.confirm(`Delete "${asset.title}" from the media library? This cannot be undone.`);
    if (!confirmed) return;

    setError('');
    setNotice('');

    try {
      const response = await fetch(`/api/proxy/media/${asset.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? 'Delete failed.');
      }

      setAssets((currentAssets) => currentAssets.filter((currentAsset) => currentAsset.id !== asset.id));
      setNotice(`Deleted ${asset.title}.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            <p className="mt-1 text-xs text-gray-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={() => void fetchAssets()}
            className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        {notice && <p className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-700">{notice}</p>}

        <form onSubmit={handleUpload} className="grid gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div>
              <label className="block text-xs font-medium text-gray-700">Upload file</label>
              <input
                key={uploadFile?.name ?? 'empty'}
                type="file"
                accept={ACCEPTED_UPLOAD_TYPES}
                onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-indigo-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Title</label>
              <input
                value={uploadTitle}
                onChange={(event) => setUploadTitle(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Optional friendly name"
              />
            </div>
            <div className="md:self-end">
              <button
                type="submit"
                disabled={uploading}
                className="w-full rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 md:w-auto"
              >
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">Alt text</label>
            <input
              value={uploadAltText}
              onChange={(event) => setUploadAltText(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="Optional alt text for image reuse"
            />
          </div>

          <p className="text-xs text-gray-500">Supports JPG, PNG, GIF, WEBP, and PDF files up to 8 MB.</p>
        </form>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm md:max-w-sm"
            placeholder="Search by title, filename, alt text, or type"
          />
          <p className="text-xs text-gray-500">{filteredAssets.length} asset{filteredAssets.length === 1 ? '' : 's'}</p>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading media…</p>
        ) : filteredAssets.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">
            No media assets match this view yet.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredAssets.map((asset) => {
              const isSelected = selectedMediaId === asset.id;
              return (
                <article
                  key={asset.id}
                  className={`overflow-hidden rounded-lg border bg-white ${isSelected ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-gray-200'}`}
                >
                  <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-gray-100">
                    {asset.isImage ? (
                      <img src={asset.url} alt={asset.altText || asset.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-center text-sm text-gray-500">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700">PDF</span>
                        <span className="px-4">{asset.title}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 p-4">
                    <div>
                      <p className="font-medium text-gray-900">{asset.title}</p>
                      <p className="mt-1 truncate text-xs text-gray-500">{asset.originalName}</p>
                    </div>

                    <dl className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <div>
                        <dt className="text-gray-400">Type</dt>
                        <dd>{asset.mimeType}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-400">Size</dt>
                        <dd>{formatBytes(asset.sizeBytes)}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-400">Uploaded</dt>
                        <dd>{new Date(asset.createdAt).toLocaleDateString()}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-400">Alt text</dt>
                        <dd className="truncate">{asset.altText || '—'}</dd>
                      </div>
                    </dl>

                    <div className="flex flex-wrap gap-2">
                      {onSelect && (
                        <button
                          type="button"
                          disabled={onlyImages && !asset.isImage}
                          onClick={() => onSelect(asset)}
                          className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                          {isSelected ? 'Selected' : 'Use as featured image'}
                        </button>
                      )}
                      {onInsert && (
                        <button
                          type="button"
                          onClick={() => onInsert(asset)}
                          className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          {asset.isImage ? 'Insert image' : 'Insert link'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleCopyUrl(asset.url)}
                        className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Copy URL
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(asset)}
                        className="rounded border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

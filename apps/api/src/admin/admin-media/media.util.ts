import { randomUUID } from 'crypto';
import { extname, resolve } from 'path';

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
const DOCUMENT_MIME_TYPES = ['application/pdf'] as const;

export const ALLOWED_MEDIA_MIME_TYPES = new Set<string>([...IMAGE_MIME_TYPES, ...DOCUMENT_MIME_TYPES]);
export const MAX_MEDIA_FILE_SIZE = 8 * 1024 * 1024;
export const MEDIA_ASSET_SELECT = {
  id: true,
  originalName: true,
  title: true,
  altText: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function isImageMimeType(mimeType: string) {
  return IMAGE_MIME_TYPES.includes(mimeType as (typeof IMAGE_MIME_TYPES)[number]);
}

export function getMediaUploadDirectory() {
  return resolve(process.cwd(), 'storage', 'media');
}

export function generateMediaStorageKey(originalName: string) {
  const extension = extname(originalName).toLowerCase();
  const safeExtension = /^\.[a-z0-9]+$/i.test(extension) ? extension : '';
  return `${randomUUID()}${safeExtension}`;
}

export function buildMediaAssetUrl(id: string) {
  return `/api/proxy/media/${id}/file`;
}

export function deriveMediaTitle(originalName: string) {
  const stem = originalName.replace(/\.[^.]+$/, '').trim();
  const normalized = stem.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized || 'Untitled media';
}

export function sanitizeDownloadName(originalName: string) {
  return originalName.replace(/[^\w.\- ]+/g, '').trim() || 'download';
}

export function serializeMediaAsset<
  T extends {
    id: string;
    originalName: string;
    title: string;
    altText: string | null;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
    updatedAt: Date;
  },
>(asset: T) {
  return {
    ...asset,
    url: buildMediaAssetUrl(asset.id),
    isImage: isImageMimeType(asset.mimeType),
  };
}

import { mkdir, writeFile } from 'fs/promises';
import { basename, join } from 'path';
import type { PrismaService } from '../../prisma/prisma.service';
import {
  ALLOWED_MEDIA_MIME_TYPES,
  MAX_MEDIA_FILE_SIZE,
  buildMediaAssetUrl,
  deriveMediaTitle,
  generateMediaStorageKey,
  getMediaUploadDirectory,
} from './media.util';

export async function downloadRemoteImageToMedia(
  prisma: PrismaService,
  sourceUrl: string | null,
  altText?: string | null,
) {
  if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) return null;

  const response = await fetch(sourceUrl);
  if (!response.ok) return null;

  const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!ALLOWED_MEDIA_MIME_TYPES.has(mimeType) || !mimeType.startsWith('image/')) return null;

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0 || buffer.length > MAX_MEDIA_FILE_SIZE) return null;

  const originalName = getOriginalNameFromUrl(sourceUrl, mimeType);
  const storageKey = generateMediaStorageKey(originalName);
  await mkdir(getMediaUploadDirectory(), { recursive: true });
  await writeFile(join(getMediaUploadDirectory(), storageKey), buffer);

  const asset = await prisma.mediaAsset.create({
    data: {
      originalName,
      storageKey,
      title: deriveMediaTitle(originalName),
      altText: altText?.trim() || null,
      mimeType,
      sizeBytes: buffer.length,
    },
    select: { id: true },
  });

  return { id: asset.id, url: buildMediaAssetUrl(asset.id) };
}

function getOriginalNameFromUrl(sourceUrl: string, mimeType: string) {
  try {
    const url = new URL(sourceUrl);
    const name = basename(url.pathname).replace(/[^\w.\- ]+/g, '').trim();
    if (name && /\.[a-z0-9]+$/i.test(name)) return name;
  } catch {
    // Fall through to generated import filename.
  }
  return `imported-image.${extensionForMimeType(mimeType)}`;
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

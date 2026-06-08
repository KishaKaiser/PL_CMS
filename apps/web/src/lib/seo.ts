import type { Metadata } from 'next';
import { getSafeImageSrc, toPlainText } from './public-cms';

const DEFAULT_SITE_URL = 'http://localhost:3000';
const DESCRIPTION_MAX_LENGTH = 160;

function trimToLength(value: string, maxLength = DESCRIPTION_MAX_LENGTH) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function normalizePath(path: string) {
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? DEFAULT_SITE_URL;

  try {
    return new URL(configuredUrl).toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export function toAbsoluteUrl(pathOrUrl?: string | null) {
  if (!pathOrUrl) return null;

  try {
    return new URL(pathOrUrl).toString();
  } catch {
    return new URL(normalizePath(pathOrUrl), `${getSiteUrl()}/`).toString();
  }
}

export function getSeoTitle(title: string, metaTitle?: string | null) {
  const normalizedMetaTitle = metaTitle?.trim();
  return normalizedMetaTitle || title;
}

export function getSeoDescription(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const plainValue = toPlainText(value ?? '').trim();
    if (plainValue) return trimToLength(plainValue);
  }

  return undefined;
}

export function buildSeoMetadata({
  title,
  description,
  path,
  imageUrl,
  siteName,
  type = 'website',
}: {
  title: string;
  description?: string;
  path: string;
  imageUrl?: string | null;
  siteName?: string;
  type?: 'website' | 'article';
}): Metadata {
  const canonical = toAbsoluteUrl(path) ?? getSiteUrl();
  const safeImage = getSafeImageSrc(imageUrl);
  const absoluteImage = safeImage ? toAbsoluteUrl(safeImage) : null;
  const images = absoluteImage ? [{ url: absoluteImage }] : undefined;

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName,
      type,
      images,
    },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title,
      description,
      images: absoluteImage ? [absoluteImage] : undefined,
    },
  };
}

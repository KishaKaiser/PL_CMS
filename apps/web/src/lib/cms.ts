export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type EditorialStatus = 'draft' | 'scheduled' | 'published';

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function isValidSlug(slug: string) {
  return SLUG_PATTERN.test(slug);
}

export function toPlainText(content: string) {
  return content
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getEditorialStatus(
  publishedAt?: string | null,
  now: Date = new Date(),
): EditorialStatus {
  if (!publishedAt) return 'draft';
  return new Date(publishedAt).getTime() > now.getTime() ? 'scheduled' : 'published';
}

export function getEditorialStatusLabel(status: EditorialStatus) {
  switch (status) {
    case 'published':
      return 'Published';
    case 'scheduled':
      return 'Scheduled';
    default:
      return 'Draft';
  }
}

export function getEditorialStatusBadgeClass(status: EditorialStatus) {
  switch (status) {
    case 'published':
      return 'bg-green-100 text-green-700';
    case 'scheduled':
      return 'bg-blue-100 text-blue-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

export function toDatetimeLocalValue(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function fromDatetimeLocalValue(value: string) {
  return new Date(value).toISOString();
}

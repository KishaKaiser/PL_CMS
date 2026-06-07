import sanitizeHtml from 'sanitize-html';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function sanitizeCmsHtml(content: string) {
  // Keep the allowlist intentionally small so authored CMS HTML can retain basic formatting without storing unsafe markup.
  return sanitizeHtml(content, {
    // Allow both semantic and presentational inline tags so pasted editor content keeps expected bold/italic formatting.
    allowedTags: ['p', 'h2', 'h3', 'blockquote', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'a', 'br', 'hr'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: (_tagName, attribs) => {
        const nextAttribs = { ...attribs };
        if (nextAttribs.target === '_blank') {
          nextAttribs.rel = 'noopener noreferrer';
        } else {
          delete nextAttribs.target;
          delete nextAttribs.rel;
        }
        return { tagName: 'a', attribs: nextAttribs };
      },
    },
  });
}

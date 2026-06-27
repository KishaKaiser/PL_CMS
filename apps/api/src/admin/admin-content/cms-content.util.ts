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
  // Keep the allowlist curated so authored CMS/product HTML can retain useful layout and media without storing unsafe markup.
  return sanitizeHtml(content, {
    allowedTags: [
      'p',
      'div',
      'span',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'ul',
      'ol',
      'li',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'sub',
      'sup',
      'a',
      'br',
      'hr',
      'img',
      'figure',
      'figcaption',
      'table',
      'thead',
      'tbody',
      'tfoot',
      'tr',
      'th',
      'td',
      'pre',
      'code',
    ],
    allowedAttributes: {
      '*': ['class', 'style', 'title'],
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      table: ['border', 'cellpadding', 'cellspacing'],
      th: ['colspan', 'rowspan', 'scope'],
      td: ['colspan', 'rowspan'],
    },
    allowedStyles: {
      '*': {
        color: [/^#(?:[0-9a-f]{3}){1,2}$/i, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i, /^[a-z]+$/i],
        'background-color': [/^#(?:[0-9a-f]{3}){1,2}$/i, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i, /^[a-z]+$/i],
        'font-size': [/^\d+(?:\.\d+)?(?:px|rem|em|%)$/],
        'font-weight': [/^(?:normal|bold|bolder|lighter|[1-9]00)$/],
        'font-style': [/^(?:normal|italic|oblique)$/],
        'text-align': [/^(?:left|right|center|justify)$/],
        'text-decoration': [/^(?:none|underline|line-through)$/],
        'margin': [/^[\d.\s-]+(?:px|rem|em|%)?$/],
        'margin-top': [/^[\d.-]+(?:px|rem|em|%)$/],
        'margin-right': [/^[\d.-]+(?:px|rem|em|%)$/],
        'margin-bottom': [/^[\d.-]+(?:px|rem|em|%)$/],
        'margin-left': [/^[\d.-]+(?:px|rem|em|%)$/],
        'padding': [/^[\d.\s-]+(?:px|rem|em|%)?$/],
        'padding-top': [/^[\d.-]+(?:px|rem|em|%)$/],
        'padding-right': [/^[\d.-]+(?:px|rem|em|%)$/],
        'padding-bottom': [/^[\d.-]+(?:px|rem|em|%)$/],
        'padding-left': [/^[\d.-]+(?:px|rem|em|%)$/],
        width: [/^\d+(?:\.\d+)?(?:px|rem|em|%)$/],
        height: [/^\d+(?:\.\d+)?(?:px|rem|em|%)$/],
      },
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

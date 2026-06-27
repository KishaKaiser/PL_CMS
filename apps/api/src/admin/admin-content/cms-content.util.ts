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
      'section',
      'article',
      'header',
      'footer',
      'main',
      'aside',
      'nav',
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
      'del',
      'ins',
      'mark',
      'small',
      'sub',
      'sup',
      'a',
      'br',
      'hr',
      'img',
      'picture',
      'source',
      'figure',
      'figcaption',
      'iframe',
      'video',
      'audio',
      'track',
      'table',
      'caption',
      'colgroup',
      'col',
      'thead',
      'tbody',
      'tfoot',
      'tr',
      'th',
      'td',
      'pre',
      'code',
      'details',
      'summary',
    ],
    allowedAttributes: {
      '*': ['id', 'class', 'style', 'title', 'aria-*', 'data-*', 'role'],
      a: ['href', 'target', 'rel', 'name'],
      iframe: ['src', 'title', 'width', 'height', 'allow', 'allowfullscreen', 'loading', 'referrerpolicy'],
      img: ['src', 'srcset', 'sizes', 'alt', 'title', 'width', 'height', 'loading'],
      source: ['src', 'srcset', 'sizes', 'type', 'media'],
      video: ['src', 'poster', 'width', 'height', 'controls', 'autoplay', 'muted', 'loop', 'playsinline', 'preload'],
      audio: ['src', 'controls', 'autoplay', 'muted', 'loop', 'preload'],
      track: ['src', 'kind', 'srclang', 'label', 'default'],
      table: ['border', 'cellpadding', 'cellspacing'],
      col: ['span', 'width'],
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
        'max-width': [/^\d+(?:\.\d+)?(?:px|rem|em|%)$/],
        'min-width': [/^\d+(?:\.\d+)?(?:px|rem|em|%)$/],
        'max-height': [/^\d+(?:\.\d+)?(?:px|rem|em|%)$/],
        'min-height': [/^\d+(?:\.\d+)?(?:px|rem|em|%)$/],
        display: [/^(?:block|inline|inline-block|flex|inline-flex|grid|none)$/],
        gap: [/^\d+(?:\.\d+)?(?:px|rem|em|%)$/],
        'align-items': [/^(?:flex-start|center|flex-end|stretch|baseline)$/],
        'justify-content': [/^(?:flex-start|center|flex-end|space-between|space-around|space-evenly)$/],
        'border': [/^[\d.\s#(),a-z%-]+$/i],
        'border-width': [/^\d+(?:\.\d+)?(?:px|rem|em|%)$/],
        'border-style': [/^(?:none|solid|dashed|dotted|double)$/],
        'border-color': [/^#(?:[0-9a-f]{3}){1,2}$/i, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i, /^[a-z]+$/i],
        'border-radius': [/^\d+(?:\.\d+)?(?:px|rem|em|%)$/],
      },
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data'],
      source: ['http', 'https', 'data'],
    },
    allowedIframeHostnames: [
      'www.youtube.com',
      'youtube.com',
      'www.youtube-nocookie.com',
      'player.vimeo.com',
      'open.spotify.com',
      'w.soundcloud.com',
    ],
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

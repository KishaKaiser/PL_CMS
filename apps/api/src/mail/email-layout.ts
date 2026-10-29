import { escapeHtml } from './escape-html';

export interface EmailContent {
  /** Plain text, with blank lines between paragraphs. Placeholders have already been filled in. */
  body: string;
  /** A call-to-action button, e.g. "Track your order". */
  button?: { label: string; url: string } | null;
  /** A sign-off after the message and button, e.g. "Thank you, The Psychic Link". */
  signature?: string;
  /** Shown small at the bottom, e.g. why they got the email. */
  footer?: string;
  /** The name shown at the top. Left out when empty. */
  siteName?: string;
  /** A logo shown at the top (a full web address). Left out when empty or not a web address. */
  logoUrl?: string;
  /** The color of the name, button and links: a six-digit hex color. */
  accentColor?: string;
}

const DEFAULT_ACCENT = '#6f21b6';

/** Only web links are put in an email (a template or a name can never inject another kind). */
export function safeUrl(value: string | null | undefined) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
}

const accentOrDefault = (value: string | undefined) => (value && /^#[0-9a-f]{6}$/i.test(value) ? value : DEFAULT_ACCENT);

/** Turns web addresses in already-escaped text into links. */
function linkify(escaped: string, accent: string) {
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, (match) => `<a href="${match}" style="color:${accent}">${match}</a>`);
}

function paragraphsToHtml(body: string, accent: string) {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p style="margin:0 0 16px;line-height:1.6">${linkify(escapeHtml(paragraph).replace(/\n/g, '<br>'), accent)}</p>`)
    .join('');
}

/** Wraps a message in a simple, readable email layout, with a plain-text version for mail apps that want one. */
export function renderEmail(content: EmailContent): { html: string; text: string } {
  const accent = accentOrDefault(content.accentColor);
  const button = content.button && safeUrl(content.button.url) ? { label: content.button.label, url: safeUrl(content.button.url) } : null;
  const siteName = content.siteName?.trim();
  const logo = safeUrl(content.logoUrl);
  const signature = content.signature?.trim();

  const header =
    logo || siteName
      ? `<div style="margin:0 0 20px">${
          logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(siteName ?? '')}" style="display:block;max-height:56px;max-width:220px;margin:0 0 ${siteName ? '8px' : '0'}">` : ''
        }${siteName ? `<span style="font-size:18px;font-weight:bold;color:${accent}">${escapeHtml(siteName)}</span>` : ''}</div>`
      : '';

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:28px">
${header}
${paragraphsToHtml(content.body, accent)}
${
  button
    ? `<p style="margin:24px 0"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:bold">${escapeHtml(button.label)}</a></p>`
    : ''
}
${signature ? `<p style="margin:0 0 16px;line-height:1.6">${linkify(escapeHtml(signature).replace(/\n/g, '<br>'), accent)}</p>` : ''}
${content.footer ? `<p style="margin:24px 0 0;font-size:12px;color:#6b7280;line-height:1.5">${linkify(escapeHtml(content.footer).replace(/\n/g, '<br>'), accent)}</p>` : ''}
</div></body></html>`;

  const text = [content.body.trim(), button ? `${button.label}: ${button.url}` : '', signature ?? '', content.footer?.trim() ?? '']
    .filter(Boolean)
    .join('\n\n');

  return { html, text };
}

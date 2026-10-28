/** The site's email settings: which mail account sends, who it is from, and where alerts go. */

export type EmailProvider = 'icloud' | 'custom';

/** iCloud Mail's outgoing server: port 587 with STARTTLS. The username is the full iCloud address; the password is an app-specific one. */
export const ICLOUD_SMTP = { host: 'smtp.mail.me.com', port: 587, secure: false } as const;

export interface EmailSettings {
  provider: EmailProvider;
  host: string;
  port: number;
  /** True for a server that is secure from the start (port 465); false for STARTTLS (port 587), which iCloud uses. */
  secure: boolean;
  username: string;
  fromName: string;
  /** Must be the iCloud address, or one of its aliases, when using iCloud. */
  fromAddress: string;
  /** Where "new order" and "new form" alerts go. */
  notifyAddress: string;
  /** The site's own address, used for the links in emails (for example https://psychiclink.link). */
  siteUrl: string;
  notifyOnOrders: boolean;
  notifyOnForms: boolean;
  /** The mail password, encrypted. Never sent to the browser. */
  passwordEnc: string;
}

export function defaultEmailSettings(): EmailSettings {
  return {
    provider: 'icloud',
    host: ICLOUD_SMTP.host,
    port: ICLOUD_SMTP.port,
    secure: ICLOUD_SMTP.secure,
    username: '',
    fromName: '',
    fromAddress: '',
    notifyAddress: '',
    siteUrl: '',
    notifyOnOrders: true,
    notifyOnForms: true,
    passwordEnc: '',
  };
}

const EMAIL_PATTERN = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const HOST_PATTERN = /^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/;

export const isEmailAddress = (value: string) => EMAIL_PATTERN.test(value.trim()) && value.length <= 254;

const text = (value: unknown, max = 200) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** A saved site address: http(s) only, no path, no trailing slash. Anything else becomes empty. */
export function normalizeSiteUrl(value: unknown): string {
  const raw = text(value, 300);
  if (!raw) return '';
  // Another kind of address (ftp://, javascript:, mailto:...) is not a site address: do not read it as a host name.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && !/^https?:\/\//i.test(raw)) return '';
  if (/^(javascript|data|mailto|file|vbscript):/i.test(raw)) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    return url.origin;
  } catch {
    return '';
  }
}

/** Reads settings as saved, filling anything missing or invalid with the defaults. */
export function normalizeEmailSettings(raw: unknown): EmailSettings {
  const defaults = defaultEmailSettings();
  if (!raw || typeof raw !== 'object') return defaults;
  const source = raw as Record<string, unknown>;
  const provider: EmailProvider = source.provider === 'custom' ? 'custom' : 'icloud';
  const port = Number(source.port);
  const host = text(source.host, 253);
  const fromAddress = text(source.fromAddress, 254);
  const notifyAddress = text(source.notifyAddress, 254);
  return {
    provider,
    // iCloud always uses its own server; "custom" takes whatever was entered.
    host: provider === 'icloud' ? ICLOUD_SMTP.host : HOST_PATTERN.test(host) ? host : '',
    port: provider === 'icloud' ? ICLOUD_SMTP.port : Number.isInteger(port) && port > 0 && port < 65536 ? port : 587,
    secure: provider === 'icloud' ? ICLOUD_SMTP.secure : source.secure === true,
    username: text(source.username, 254),
    fromName: text(source.fromName, 100).replace(/[\r\n"<>]/g, ''),
    fromAddress: isEmailAddress(fromAddress) ? fromAddress : '',
    notifyAddress: isEmailAddress(notifyAddress) ? notifyAddress : '',
    siteUrl: normalizeSiteUrl(source.siteUrl),
    notifyOnOrders: source.notifyOnOrders !== false,
    notifyOnForms: source.notifyOnForms !== false,
    passwordEnc: typeof source.passwordEnc === 'string' ? source.passwordEnc : '',
  };
}

/** What the admin page is sent: everything except the password, plus whether one is saved. */
export function toPublicEmailSettings(settings: EmailSettings) {
  const { passwordEnc, ...rest } = settings;
  return { ...rest, passwordSet: passwordEnc.length > 0 };
}

/** "Name <address>", with the name cleaned so it cannot break the header. */
export function formatFrom(name: string, address: string) {
  const cleanName = name.replace(/[\r\n"<>]/g, '').trim();
  return cleanName ? `"${cleanName}" <${address}>` : address;
}

import { isIP } from 'node:net';

/**
 * The address a request really came from, for rules such as "one promotion per address".
 *
 * The site sits behind nginx (and sometimes a tunnel) and the web server, and each of them adds to X-Forwarded-For, so the
 * list can start with whatever the visitor chose to send. Only the entries added by our own proxies, at the right-hand end,
 * can be trusted, so the list is read from the right and the first public address is the visitor. Private addresses are our
 * own proxies, so they are skipped; on a home network where every address is private, the right-most one is used.
 */
export function clientIp(req: { headers: Record<string, string | string[] | undefined>; ip?: string }): string | undefined {
  const header = req.headers['x-forwarded-for'];
  const entries = (Array.isArray(header) ? header.join(',') : (header ?? ''))
    .split(',')
    .map((entry) => normalizeIp(entry))
    .filter((entry): entry is string => entry !== null);
  for (let i = entries.length - 1; i >= 0; i--) {
    if (!isPrivateIp(entries[i])) return entries[i];
  }
  if (entries.length > 0) return entries[entries.length - 1];
  return req.ip ? (normalizeIp(req.ip) ?? undefined) : undefined;
}

/** A clean address: no port, no brackets, and an IPv4 address that arrived as ::ffff:1.2.3.4 written plainly. Null when it is not an address. */
export function normalizeIp(value: string): string | null {
  let text = value.trim();
  if (!text) return null;
  if (text.startsWith('[')) {
    const end = text.indexOf(']');
    if (end === -1) return null;
    text = text.slice(1, end);
  } else if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(text)) {
    text = text.slice(0, text.lastIndexOf(':'));
  }
  text = text.replace(/%.*$/, '');
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(text);
  if (mapped) text = mapped[1];
  const version = isIP(text);
  if (version === 0) return null;
  return version === 6 ? text.toLowerCase() : text;
}

export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  const groups = expandIpv6(ip);
  if (!groups) return false;
  const first = groups[0];
  const loopbackOrUnspecified = groups.slice(0, 7).every((group) => group === 0) && groups[7] <= 1;
  return loopbackOrUnspecified || (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80;
}

/**
 * What identifies "one internet connection" for the promotion. A household usually gets a whole /64 of IPv6 addresses and
 * phones and computers rotate through them, so an IPv6 address counts as its /64 network; an IPv4 address is itself.
 */
export function ipKey(ip: string): string {
  if (isIP(ip) !== 6) return ip;
  const groups = expandIpv6(ip);
  if (!groups) return ip;
  return `${groups
    .slice(0, 4)
    .map((group) => group.toString(16))
    .join(':')}::/64`;
}

function expandIpv6(ip: string): number[] | null {
  let text = ip;
  const embedded = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (embedded) {
    const [a, b, c, d] = embedded[1].split('.').map(Number);
    text = text.slice(0, embedded.index) + ((a << 8) | b).toString(16) + ':' + ((c << 8) | d).toString(16);
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 0) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...tail].map((group) => parseInt(group, 16));
  return groups.length === 8 && groups.every((group) => Number.isInteger(group)) ? groups : null;
}

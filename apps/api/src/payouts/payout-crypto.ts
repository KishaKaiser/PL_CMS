import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Bank details are stored encrypted (AES-256-GCM) so a copy of the database does not reveal them. The key comes from
 * PAYOUT_ENCRYPTION_KEY, or failing that from this site's own JWT refresh secret, which is generated once and kept.
 * Output looks like "v1.<iv>.<tag>.<data>" in base64url.
 */

const VERSION = 'v1';

function keyFrom(secret: string): Buffer {
  return createHash('sha256').update(`payout-details:${secret}`).digest();
}

export function encryptJson(value: unknown, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(secret), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

/** Returns null if the value was not produced with this secret (or has been tampered with). */
export function decryptJson<T = unknown>(payload: string, secret: string): T | null {
  const [version, iv, tag, data] = payload.split('.');
  if (version !== VERSION || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', keyFrom(secret), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    const plain = Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]);
    return JSON.parse(plain.toString('utf8')) as T;
  } catch {
    return null;
  }
}

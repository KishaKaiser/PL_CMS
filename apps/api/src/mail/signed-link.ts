import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * A signed value for a link in an email, such as "stop these reminders". It is made with a secret only this site knows, so
 * it works without logging in, and cannot be made for someone else's address. `purpose` keeps a link made for one use from
 * working for another.
 */
export function signLink(purpose: string, value: string, secret: string): string {
  return createHmac('sha256', secret).update(`${purpose}:${value.trim().toLowerCase()}`).digest('hex');
}

export function verifyLink(purpose: string, value: string, signature: string, secret: string): boolean {
  if (!secret || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(signLink(purpose, value, secret), 'hex');
  const given = Buffer.from(signature, 'hex');
  return expected.length === given.length && timingSafeEqual(expected, given);
}

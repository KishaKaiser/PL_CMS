import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * The link at the bottom of newsletter emails. It is signed with a secret only this site knows, so it works without logging
 * in, and nobody can unsubscribe someone else by guessing an address.
 */
export function unsubscribeToken(email: string, secret: string): string {
  return createHmac('sha256', secret).update(`newsletter-unsubscribe:${email.trim().toLowerCase()}`).digest('hex');
}

export function isValidUnsubscribeToken(email: string, token: string, secret: string): boolean {
  if (!secret || !/^[0-9a-f]{64}$/i.test(token)) return false;
  const expected = Buffer.from(unsubscribeToken(email, secret), 'hex');
  const given = Buffer.from(token, 'hex');
  return expected.length === given.length && timingSafeEqual(expected, given);
}

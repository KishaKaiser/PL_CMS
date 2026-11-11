/**
 * What counts as an email address a customer can really receive mail at. Stricter than the email standard on purpose: the standard
 * allows characters such as ` { } | ! # $ ^ * = ? that no real mailbox uses, so a slip of the finger (a stray ` before the name)
 * would be accepted and the order emails would bounce.
 *
 * Letters (any language) and digits, and . _ % + ' - in the name; no leading or trailing dot, no two dots in a row; a domain with
 * at least one dot and a last part of letters only.
 */
export const DELIVERABLE_EMAIL_SOURCE =
  String.raw`^(?!.*\.\.)[\p{L}\p{N}_%+'\-][\p{L}\p{N}._%+'\-]*(?<!\.)@(?:[\p{L}\p{N}](?:[\p{L}\p{N}\-]*[\p{L}\p{N}])?\.)+[\p{L}]{2,}$`;

const DELIVERABLE_EMAIL = new RegExp(DELIVERABLE_EMAIL_SOURCE, 'u');

export function isDeliverableEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && DELIVERABLE_EMAIL.test(value.trim());
}

export const INVALID_EMAIL_MESSAGE = 'Enter a valid email address (letters, numbers and . _ - + only before the @).';

/**
 * The address to send a customer's order emails to: the one they gave at checkout when it is a real-looking address, otherwise the
 * email on their account. (Checkout checks the address, but orders placed before that check, or an address the shop owner edited,
 * can still hold a bad one.)
 */
export function customerEmailFor(orderEmail: string | null | undefined, accountEmail: string): string {
  const given = orderEmail?.trim();
  return given && isDeliverableEmail(given) ? given : accountEmail;
}

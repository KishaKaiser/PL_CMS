export function toCents(value: number | string): number {
  return Math.round(Number(value) * 100);
}

export function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** The API's error message, or a fallback. Validation errors arrive as a list of messages. */
export async function readMessage(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
  if (Array.isArray(data.message)) return data.message.join(' ');
  return data.message ?? fallback;
}

/** "+18885550100" becomes "1-888-555-0100"; anything else is shown as it was given. */
export function formatPhoneForDisplay(e164: string): string {
  const match = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return match ? `1-${match[1]}-${match[2]}-${match[3]}` : e164;
}

/** Index 0 is Sunday, matching the API. */
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The order a week is usually shown in: Monday first. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** "13:30" becomes "1:30 PM" (or "13:30" in 24-hour locales). */
export function formatTimeOfDay(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

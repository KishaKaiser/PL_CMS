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

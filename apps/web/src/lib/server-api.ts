const DEFAULT_API_BASES = ['http://127.0.0.1:3001/api', 'http://localhost:3001/api', 'http://api:3001/api'];

export function getApiBaseCandidates() {
  const configured = [
    process.env.API_BASE_URL,
    process.env.INTERNAL_API_BASE_URL,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.replace(/\/$/, ''));

  return Array.from(new Set([...configured, ...DEFAULT_API_BASES]));
}

export async function fetchApi(path: string, init?: RequestInit) {
  let lastError: unknown = null;

  for (const base of getApiBaseCandidates()) {
    try {
      return await fetch(`${base}${path}`, init);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('API request failed');
}

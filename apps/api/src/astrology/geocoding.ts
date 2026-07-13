export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName?: string;
}

const DEFAULT_TIMEOUT_MS = 8_000;

export async function geocodeBirthLocation(input: {
  city?: string;
  state?: string;
  country?: string;
}): Promise<GeocodeResult | null> {
  const city = input.city?.trim();
  const state = input.state?.trim();
  const country = input.country?.trim();
  const query = [city, state, country].filter(Boolean).join(', ');
  if (!query) return null;

  const endpoint = process.env.GEOCODING_ENDPOINT || 'https://nominatim.openstreetmap.org/search';
  const timeoutMs = Number(process.env.GEOCODING_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const url = new URL(endpoint);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', query);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': process.env.GEOCODING_USER_AGENT || 'PL_CMS Astrology Module',
      },
    });
    if (!response.ok) return null;

    const results = (await response.json()) as Array<{
      lat?: string;
      lon?: string;
      display_name?: string;
    }>;
    const first = Array.isArray(results) ? results[0] : null;
    const latitude = Number(first?.lat);
    const longitude = Number(first?.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return {
      latitude,
      longitude,
      displayName: first?.display_name,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

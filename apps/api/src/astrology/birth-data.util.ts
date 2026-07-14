import { BadRequestException } from '@nestjs/common';
import { geocodeBirthLocation } from './geocoding';

export function isCoordinateInRange(value: number | null | undefined, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

export function readOptionalNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export interface ResolvedBirthLocation {
  latitude: number;
  longitude: number;
  location: string;
  coordinateSource: 'provided' | 'geocoded';
}

/**
 * Shared by every astrology report type: use provided coordinates if valid,
 * otherwise geocode from city/state/country. Throws if neither resolves to a
 * usable lat/lon.
 */
export async function resolveBirthCoordinates(input: {
  city: string;
  state?: string | null;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<ResolvedBirthLocation> {
  const city = input.city.trim();
  const state = input.state?.trim() || '';
  const country = input.country.trim();
  const providedLatitude = readOptionalNumber(input.latitude);
  const providedLongitude = readOptionalNumber(input.longitude);
  const hasProvidedCoordinates = isCoordinateInRange(providedLatitude, -90, 90) && isCoordinateInRange(providedLongitude, -180, 180);

  const geocoded = hasProvidedCoordinates ? null : await geocodeBirthLocation({ city, state, country });
  const latitude = hasProvidedCoordinates ? providedLatitude : geocoded?.latitude ?? null;
  const longitude = hasProvidedCoordinates ? providedLongitude : geocoded?.longitude ?? null;

  if (!isCoordinateInRange(latitude, -90, 90) || !isCoordinateInRange(longitude, -180, 180)) {
    throw new BadRequestException(
      'The birth location could not be resolved to valid coordinates. Check the city, state, and country.',
    );
  }

  return {
    latitude: latitude as number,
    longitude: longitude as number,
    location: geocoded?.displayName || [city, state, country].filter(Boolean).join(', '),
    coordinateSource: hasProvidedCoordinates ? 'provided' : 'geocoded',
  };
}

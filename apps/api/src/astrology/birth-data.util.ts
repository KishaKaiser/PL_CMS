import { BadRequestException } from '@nestjs/common';
import { calculateDST } from './lib/dst-calculator';
import { findTimezoneByCoordinates, getTimezoneOffset } from './lib/timezone-db';
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
  timezone: string;
}

/**
 * Looks up the historically-correct UTC offset (accounting for DST rules that
 * were in effect on the given date) for a coordinate pair, mirroring what the
 * original astrology app resolved automatically from its location search.
 */
export function resolveBirthTimezone(latitude: number, longitude: number, date: string, time?: string | null): string {
  const timezoneId = findTimezoneByCoordinates(latitude, longitude);
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return getTimezoneOffset(timezoneId);

  const [hour, minute] = (time || '12:00').split(':').map(Number);
  const localDate = new Date(year, month - 1, day, Number.isFinite(hour) ? hour : 12, Number.isFinite(minute) ? minute : 0, 0);
  return calculateDST(localDate, timezoneId).effectiveOffset;
}

/**
 * Shared by every astrology report type: use provided coordinates if valid,
 * otherwise geocode from city/state/country; the UTC offset is then always
 * calculated automatically from those coordinates and the birth date (an
 * explicit override is honored only if one is supplied — the admin/checkout
 * forms no longer collect one). Throws if coordinates can't be resolved.
 */
export async function resolveBirthCoordinates(input: {
  city: string;
  state?: string | null;
  country: string;
  date: string;
  time?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezoneOverride?: string | null;
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

  const timezone = input.timezoneOverride?.trim()
    || resolveBirthTimezone(latitude as number, longitude as number, input.date, input.time);

  return {
    latitude: latitude as number,
    longitude: longitude as number,
    location: geocoded?.displayName || [city, state, country].filter(Boolean).join(', '),
    coordinateSource: hasProvidedCoordinates ? 'provided' : 'geocoded',
    timezone,
  };
}

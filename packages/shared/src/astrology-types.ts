// ──────────────────────────────────────────────
// Astrology module — canonical chart data types
// Shared between apps/api (chart generation) and apps/web (chart wheel + admin UI)
// ──────────────────────────────────────────────

export interface Planet {
  name: string;
  symbol: string;
  longitude: number;
  sign: string;
  degree: number;
  house: number;
}

export interface House {
  number: number;
  cusp: number;
  sign: string;
}

export interface Aspect {
  planet1: string;
  planet2: string;
  type: string;
  orb: number;
  angle: number;
  color: string;
}

export interface AspectPattern {
  type: 'T-Square' | 'Grand Trine' | 'Grand Cross' | 'Yod' | 'Kite' | 'Grand Sextile' | 'Mystic Rectangle' | 'Stellium';
  planets: string[];
  description: string;
  element?: string;
  modality?: string;
  color: string;
  interpretation: string;
}

export interface TransitAspect {
  transitPlanet: string;
  natalPlanet: string;
  type: string;
  orb: number;
  angle: number;
  color: string;
}

export interface TransitData {
  planets: Planet[];
  aspects: TransitAspect[];
  calculatedAt: Date;
}

export interface ChartData {
  id: string;
  name: string;
  date: string;
  time: string;
  location: string;
  latitude: number;
  longitude: number;
  timezone: string;
  coordinateSource: 'provided' | 'geocoded' | 'fallback';
  notes?: string | null;
  interpretation?: string;
  planets: Planet[];
  houses: House[];
  aspects: Aspect[];
  aspectPatterns: AspectPattern[];
  ascendant: number;
  midheaven: number;
  houseSystem: string;
  createdAt: number;
  updatedAt: number;
}

export type ZodiacSign =
  | 'Aries' | 'Taurus' | 'Gemini' | 'Cancer'
  | 'Leo' | 'Virgo' | 'Libra' | 'Scorpio'
  | 'Sagittarius' | 'Capricorn' | 'Aquarius' | 'Pisces';

export const ZODIAC_SIGNS: ZodiacSign[] = [
  'Aries', 'Taurus', 'Gemini', 'Cancer',
  'Leo', 'Virgo', 'Libra', 'Scorpio',
  'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

export const ZODIAC_SYMBOLS: Record<ZodiacSign, string> = {
  Aries: '♈',
  Taurus: '♉',
  Gemini: '♊',
  Cancer: '♋',
  Leo: '♌',
  Virgo: '♍',
  Libra: '♎',
  Scorpio: '♏',
  Sagittarius: '♐',
  Capricorn: '♑',
  Aquarius: '♒',
  Pisces: '♓',
};

export const PLANET_SYMBOLS: Record<string, string> = {
  Sun: '☉',
  Moon: '☽',
  Mercury: '☿',
  Venus: '♀',
  Mars: '♂',
  Jupiter: '♃',
  Saturn: '♄',
  Uranus: '♅',
  Neptune: '♆',
  Pluto: '♇',
  Chiron: '⚷',
  'North Node': '☊',
  'South Node': '☋',
  'Part of Fortune': '⊕',
};

export const ASPECT_TYPES = {
  conjunction: { angle: 0, orb: 8, name: 'Conjunction', symbol: '☌', color: 'oklch(0.78 0.15 85)' },
  opposition: { angle: 180, orb: 8, name: 'Opposition', symbol: '☍', color: 'oklch(0.55 0.22 25)' },
  trine: { angle: 120, orb: 8, name: 'Trine', symbol: '△', color: 'oklch(0.70 0.20 150)' },
  square: { angle: 90, orb: 7, name: 'Square', symbol: '□', color: 'oklch(0.60 0.22 40)' },
  sextile: { angle: 60, orb: 6, name: 'Sextile', symbol: '⚹', color: 'oklch(0.75 0.18 200)' },
};

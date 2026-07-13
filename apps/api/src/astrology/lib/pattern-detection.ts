import type { ChartData } from '@pl-cms/shared';

export interface LifeEvent {
  id: string;
  chartId: string;
  date: string;
  title: string;
  description: string;
  category: 'career' | 'relationship' | 'health' | 'spiritual' | 'family' | 'education' | 'travel' | 'other';
  transitData?: {
    planets: Array<{ name: string; sign: string; degree: number; house: number }>;
    significantTransits: string[];
  };
  createdAt: number;
}

export interface AstrologicalPattern {
  id: string;
  type: 'transit' | 'house' | 'planet' | 'sign' | 'cycle';
  name: string;
  description: string;
  occurrences: Array<{ eventId: string; eventTitle: string; eventDate: string; relevantData: string }>;
  frequency: number;
  significance: 'high' | 'medium' | 'low';
  color: string;
}

export function detectRecurringPatterns(events: LifeEvent[], chart: ChartData): AstrologicalPattern[] {
  const transitPatterns = findTransitPatterns(events);
  const housePatterns = findHousePatterns(events);
  const planetaryPatterns = findPlanetaryPatterns(events);
  const signPatterns = findSignPatterns(events);
  const cyclePatterns = findCyclePatterns(events, chart);

  return [...transitPatterns, ...housePatterns, ...planetaryPatterns, ...signPatterns, ...cyclePatterns].filter(
    (p) => p.occurrences.length >= 2,
  );
}

function findTransitPatterns(events: LifeEvent[]): AstrologicalPattern[] {
  const patterns: AstrologicalPattern[] = [];
  const transitMap = new Map<string, Array<{ eventId: string; eventTitle: string; eventDate: string }>>();

  events.forEach((event) => {
    if (!event.transitData?.significantTransits) return;

    event.transitData.significantTransits.forEach((transit) => {
      const normalizedTransit = normalizeTransitString(transit);
      if (!transitMap.has(normalizedTransit)) {
        transitMap.set(normalizedTransit, []);
      }
      transitMap.get(normalizedTransit)!.push({ eventId: event.id, eventTitle: event.title, eventDate: event.date });
    });
  });

  transitMap.forEach((occurrences, transitType) => {
    if (occurrences.length >= 2) {
      patterns.push({
        id: `transit-${transitType}`,
        type: 'transit',
        name: transitType,
        description: `This aspect pattern has appeared ${occurrences.length} times during significant life events`,
        occurrences: occurrences.map((occ) => ({ ...occ, relevantData: transitType })),
        frequency: occurrences.length,
        significance: occurrences.length >= 4 ? 'high' : occurrences.length >= 3 ? 'medium' : 'low',
        color: 'oklch(0.78 0.15 85)',
      });
    }
  });

  return patterns;
}

function findHousePatterns(events: LifeEvent[]): AstrologicalPattern[] {
  const patterns: AstrologicalPattern[] = [];
  const houseMap = new Map<number, Array<{ eventId: string; eventTitle: string; eventDate: string; planets: string[] }>>();

  events.forEach((event) => {
    if (!event.transitData?.planets) return;

    const houseCounts = new Map<number, string[]>();
    event.transitData.planets.forEach((planet) => {
      if (!houseCounts.has(planet.house)) {
        houseCounts.set(planet.house, []);
      }
      houseCounts.get(planet.house)!.push(planet.name);
    });

    houseCounts.forEach((planets, house) => {
      if (planets.length >= 2) {
        if (!houseMap.has(house)) {
          houseMap.set(house, []);
        }
        houseMap.get(house)!.push({ eventId: event.id, eventTitle: event.title, eventDate: event.date, planets });
      }
    });
  });

  houseMap.forEach((occurrences, house) => {
    if (occurrences.length >= 2) {
      patterns.push({
        id: `house-${house}`,
        type: 'house',
        name: `${getHouseName(house)} Activation`,
        description: `Multiple planetary transits through the ${getHouseName(house)} during important life moments`,
        occurrences: occurrences.map((occ) => ({
          eventId: occ.eventId,
          eventTitle: occ.eventTitle,
          eventDate: occ.eventDate,
          relevantData: `${occ.planets.join(', ')} in House ${house}`,
        })),
        frequency: occurrences.length,
        significance: occurrences.length >= 4 ? 'high' : occurrences.length >= 3 ? 'medium' : 'low',
        color: 'oklch(0.70 0.22 285)',
      });
    }
  });

  return patterns;
}

function findPlanetaryPatterns(events: LifeEvent[]): AstrologicalPattern[] {
  const patterns: AstrologicalPattern[] = [];
  const planetMap = new Map<string, Array<{ eventId: string; eventTitle: string; eventDate: string; context: string }>>();

  events.forEach((event) => {
    if (!event.transitData?.significantTransits) return;

    event.transitData.significantTransits.forEach((transit) => {
      const planets = extractPlanetsFromTransit(transit);
      planets.forEach((planet) => {
        if (!planetMap.has(planet)) {
          planetMap.set(planet, []);
        }
        planetMap.get(planet)!.push({ eventId: event.id, eventTitle: event.title, eventDate: event.date, context: transit });
      });
    });
  });

  planetMap.forEach((occurrences, planet) => {
    if (occurrences.length >= 3) {
      patterns.push({
        id: `planet-${planet}`,
        type: 'planet',
        name: `${planet} Activation`,
        description: `${planet} has been involved in significant aspects during ${occurrences.length} major life events`,
        occurrences: occurrences.map((occ) => ({
          eventId: occ.eventId,
          eventTitle: occ.eventTitle,
          eventDate: occ.eventDate,
          relevantData: occ.context,
        })),
        frequency: occurrences.length,
        significance: occurrences.length >= 5 ? 'high' : occurrences.length >= 4 ? 'medium' : 'low',
        color: 'oklch(0.75 0.25 0)',
      });
    }
  });

  return patterns;
}

function findSignPatterns(events: LifeEvent[]): AstrologicalPattern[] {
  const patterns: AstrologicalPattern[] = [];
  const signMap = new Map<string, Array<{ eventId: string; eventTitle: string; eventDate: string; planets: string[] }>>();

  events.forEach((event) => {
    if (!event.transitData?.planets) return;

    const signCounts = new Map<string, string[]>();
    event.transitData.planets.forEach((planet) => {
      if (!signCounts.has(planet.sign)) {
        signCounts.set(planet.sign, []);
      }
      signCounts.get(planet.sign)!.push(planet.name);
    });

    signCounts.forEach((planets, sign) => {
      if (planets.length >= 3) {
        if (!signMap.has(sign)) {
          signMap.set(sign, []);
        }
        signMap.get(sign)!.push({ eventId: event.id, eventTitle: event.title, eventDate: event.date, planets });
      }
    });
  });

  signMap.forEach((occurrences, sign) => {
    if (occurrences.length >= 2) {
      patterns.push({
        id: `sign-${sign}`,
        type: 'sign',
        name: `${sign} Stellium Pattern`,
        description: `Multiple planets in ${sign} during significant life events, indicating focused energy in this zodiacal area`,
        occurrences: occurrences.map((occ) => ({
          eventId: occ.eventId,
          eventTitle: occ.eventTitle,
          eventDate: occ.eventDate,
          relevantData: `${occ.planets.join(', ')} in ${sign}`,
        })),
        frequency: occurrences.length,
        significance: occurrences.length >= 3 ? 'high' : 'medium',
        color: 'oklch(0.72 0.20 50)',
      });
    }
  });

  return patterns;
}

function findCyclePatterns(events: LifeEvent[], chart: ChartData): AstrologicalPattern[] {
  const patterns: AstrologicalPattern[] = [];

  const saturnReturns = findSaturnReturns(events, chart);
  if (saturnReturns.length >= 1) {
    patterns.push({
      id: 'cycle-saturn-return',
      type: 'cycle',
      name: 'Saturn Return Influence',
      description: 'Events occurring during or near Saturn return periods, marking major life transitions and maturation',
      occurrences: saturnReturns,
      frequency: saturnReturns.length,
      significance: 'high',
      color: 'oklch(0.65 0.18 140)',
    });
  }

  const jupiterReturns = findJupiterReturns(events, chart);
  if (jupiterReturns.length >= 2) {
    patterns.push({
      id: 'cycle-jupiter-return',
      type: 'cycle',
      name: 'Jupiter Return Cycle',
      description: 'Events aligned with Jupiter returns (every ~12 years), indicating expansion and growth opportunities',
      occurrences: jupiterReturns,
      frequency: jupiterReturns.length,
      significance: 'medium',
      color: 'oklch(0.68 0.22 240)',
    });
  }

  return patterns;
}

function findSaturnReturns(events: LifeEvent[], chart: ChartData): Array<{ eventId: string; eventTitle: string; eventDate: string; relevantData: string }> {
  const natalSaturn = chart.planets.find((p) => p.name === 'Saturn');
  if (!natalSaturn) return [];

  return events
    .filter((event) => {
      if (!event.transitData?.planets) return false;
      const transitSaturn = event.transitData.planets.find((p) => p.name === 'Saturn');
      if (!transitSaturn) return false;

      const orb = Math.abs(transitSaturn.degree - natalSaturn.degree);
      return orb < 10 || 360 - orb < 10;
    })
    .map((event) => ({ eventId: event.id, eventTitle: event.title, eventDate: event.date, relevantData: 'Saturn near natal position' }));
}

function findJupiterReturns(events: LifeEvent[], chart: ChartData): Array<{ eventId: string; eventTitle: string; eventDate: string; relevantData: string }> {
  const natalJupiter = chart.planets.find((p) => p.name === 'Jupiter');
  if (!natalJupiter) return [];

  return events
    .filter((event) => {
      if (!event.transitData?.planets) return false;
      const transitJupiter = event.transitData.planets.find((p) => p.name === 'Jupiter');
      if (!transitJupiter) return false;

      const orb = Math.abs(transitJupiter.degree - natalJupiter.degree);
      return orb < 8 || 360 - orb < 8;
    })
    .map((event) => ({ eventId: event.id, eventTitle: event.title, eventDate: event.date, relevantData: 'Jupiter near natal position' }));
}

function normalizeTransitString(transit: string): string {
  const aspectMap: Record<string, string> = {
    conjunct: 'conjunction',
    opposite: 'opposition',
    square: 'square',
    trine: 'trine',
    sextile: 'sextile',
  };

  for (const [key, value] of Object.entries(aspectMap)) {
    if (transit.toLowerCase().includes(key)) {
      const parts = transit.split(' ');
      const transitPlanet = parts[0];
      const natalPlanet = parts[parts.length - 1];
      return `${transitPlanet} ${value} ${natalPlanet}`;
    }
  }

  return transit;
}

function extractPlanetsFromTransit(transit: string): string[] {
  const planets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
  const found: string[] = [];

  planets.forEach((planet) => {
    if (transit.includes(planet)) {
      found.push(planet);
    }
  });

  return found;
}

function getHouseName(house: number): string {
  const houseNames: Record<number, string> = {
    1: '1st House (Self & Identity)',
    2: '2nd House (Resources & Values)',
    3: '3rd House (Communication & Learning)',
    4: '4th House (Home & Family)',
    5: '5th House (Creativity & Romance)',
    6: '6th House (Work & Health)',
    7: '7th House (Partnerships)',
    8: '8th House (Transformation)',
    9: '9th House (Philosophy & Travel)',
    10: '10th House (Career & Status)',
    11: '11th House (Community & Goals)',
    12: '12th House (Spirituality & Unconscious)',
  };

  return houseNames[house] || `${house}th House`;
}

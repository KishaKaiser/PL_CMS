import type { ChartData, Planet } from '@pl-cms/shared';
import { generateChartData } from '../chart-engine';

export type EventType =
  | 'wedding'
  | 'business_launch'
  | 'surgery'
  | 'travel'
  | 'signing_contract'
  | 'moving'
  | 'investment'
  | 'interview'
  | 'first_date'
  | 'proposal'
  | 'purchase'
  | 'creative_project';

export interface ElectionCriteria {
  eventType: EventType;
  startDate: string;
  endDate: string;
  location: string;
  latitude: number;
  longitude: number;
  timezone: string;
  timeRange?: { start: string; end: string };
  avoidRetrograde?: boolean;
  preferDaylight?: boolean;
}

export interface ElectionResult {
  id: string;
  date: string;
  time: string;
  score: number;
  chart: ChartData;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
  moonPhase: string;
  retrogradeWarnings: string[];
}

export interface ElectionAnalysis {
  criteria: ElectionCriteria;
  results: ElectionResult[];
  bestDate: ElectionResult | null;
  generatedAt: number;
}

const EVENT_PRIORITIES: Record<EventType, {
  beneficPlanets: string[];
  maleficPlanets: string[];
  importantHouses: number[];
  favorableAspects: string[];
  unfavorableAspects: string[];
}> = {
  wedding: {
    beneficPlanets: ['Venus', 'Jupiter', 'Sun'],
    maleficPlanets: ['Saturn', 'Mars', 'Uranus'],
    importantHouses: [1, 7, 5, 11],
    favorableAspects: ['Trine', 'Sextile', 'Conjunction'],
    unfavorableAspects: ['Square', 'Opposition'],
  },
  business_launch: {
    beneficPlanets: ['Jupiter', 'Sun', 'Mercury'],
    maleficPlanets: ['Saturn', 'Neptune'],
    importantHouses: [1, 10, 2, 11],
    favorableAspects: ['Trine', 'Sextile'],
    unfavorableAspects: ['Square', 'Opposition'],
  },
  surgery: {
    beneficPlanets: ['Jupiter', 'Venus'],
    maleficPlanets: ['Mars', 'Saturn', 'Uranus'],
    importantHouses: [1, 6, 8, 12],
    favorableAspects: ['Trine', 'Sextile'],
    unfavorableAspects: ['Square', 'Opposition', 'Conjunction'],
  },
  travel: {
    beneficPlanets: ['Jupiter', 'Mercury', 'Venus'],
    maleficPlanets: ['Saturn', 'Mars'],
    importantHouses: [3, 9, 1],
    favorableAspects: ['Trine', 'Sextile'],
    unfavorableAspects: ['Square', 'Opposition'],
  },
  signing_contract: {
    beneficPlanets: ['Mercury', 'Jupiter', 'Venus'],
    maleficPlanets: ['Neptune', 'Saturn'],
    importantHouses: [3, 7, 10],
    favorableAspects: ['Trine', 'Sextile', 'Conjunction'],
    unfavorableAspects: ['Square', 'Opposition'],
  },
  moving: {
    beneficPlanets: ['Jupiter', 'Venus', 'Moon'],
    maleficPlanets: ['Saturn', 'Mars', 'Uranus'],
    importantHouses: [4, 1, 2],
    favorableAspects: ['Trine', 'Sextile'],
    unfavorableAspects: ['Square', 'Opposition'],
  },
  investment: {
    beneficPlanets: ['Jupiter', 'Venus', 'Sun'],
    maleficPlanets: ['Neptune', 'Saturn', 'Uranus'],
    importantHouses: [2, 8, 5, 11],
    favorableAspects: ['Trine', 'Sextile'],
    unfavorableAspects: ['Square', 'Opposition'],
  },
  interview: {
    beneficPlanets: ['Mercury', 'Jupiter', 'Sun'],
    maleficPlanets: ['Saturn', 'Neptune'],
    importantHouses: [1, 10, 6],
    favorableAspects: ['Trine', 'Sextile'],
    unfavorableAspects: ['Square', 'Opposition'],
  },
  first_date: {
    beneficPlanets: ['Venus', 'Jupiter', 'Moon'],
    maleficPlanets: ['Saturn', 'Mars'],
    importantHouses: [1, 5, 7],
    favorableAspects: ['Trine', 'Sextile', 'Conjunction'],
    unfavorableAspects: ['Square', 'Opposition'],
  },
  proposal: {
    beneficPlanets: ['Venus', 'Jupiter', 'Sun'],
    maleficPlanets: ['Saturn', 'Mars', 'Uranus'],
    importantHouses: [1, 5, 7],
    favorableAspects: ['Trine', 'Sextile', 'Conjunction'],
    unfavorableAspects: ['Square', 'Opposition'],
  },
  purchase: {
    beneficPlanets: ['Venus', 'Jupiter', 'Mercury'],
    maleficPlanets: ['Neptune', 'Saturn'],
    importantHouses: [2, 4, 10],
    favorableAspects: ['Trine', 'Sextile'],
    unfavorableAspects: ['Square', 'Opposition'],
  },
  creative_project: {
    beneficPlanets: ['Venus', 'Neptune', 'Sun'],
    maleficPlanets: ['Saturn', 'Mars'],
    importantHouses: [5, 3, 11],
    favorableAspects: ['Trine', 'Sextile', 'Conjunction'],
    unfavorableAspects: ['Square', 'Opposition'],
  },
};

function calculateMoonPhase(moonLongitude: number, sunLongitude: number): string {
  const phase = (moonLongitude - sunLongitude + 360) % 360;

  if (phase < 45) return 'New Moon';
  if (phase < 90) return 'Waxing Crescent';
  if (phase < 135) return 'First Quarter';
  if (phase < 180) return 'Waxing Gibbous';
  if (phase < 225) return 'Full Moon';
  if (phase < 270) return 'Waning Gibbous';
  if (phase < 315) return 'Last Quarter';
  return 'Waning Crescent';
}

// This engine does not track planetary velocity, so retrograde status can't
// be determined; kept as an explicit stub rather than a guess.
function isRetrograde(_planet: Planet): boolean {
  return false;
}

function scoreChart(chart: ChartData, eventType: EventType, criteria: ElectionCriteria): {
  score: number;
  strengths: string[];
  weaknesses: string[];
  retrogradeWarnings: string[];
} {
  const priorities = EVENT_PRIORITIES[eventType];
  let score = 50;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const retrogradeWarnings: string[] = [];

  const sun = chart.planets.find((p) => p.name === 'Sun');
  const moon = chart.planets.find((p) => p.name === 'Moon');

  if (moon && sun) {
    const moonPhase = calculateMoonPhase(moon.longitude, sun.longitude);

    if (['New Moon', 'Waxing Crescent', 'First Quarter'].includes(moonPhase)) {
      score += 5;
      strengths.push(`${moonPhase} supports new beginnings`);
    } else if (moonPhase === 'Full Moon') {
      score += 3;
      strengths.push('Full Moon brings energy and visibility');
    }
  }

  priorities.beneficPlanets.forEach((planetName) => {
    const planet = chart.planets.find((p) => p.name === planetName);
    if (!planet) return;

    if (criteria.avoidRetrograde && isRetrograde(planet)) {
      score -= 8;
      retrogradeWarnings.push(`${planetName} is retrograde - reconsider timing`);
    }

    const aspects = chart.aspects.filter((a) => a.planet1 === planetName || a.planet2 === planetName);

    aspects.forEach((aspect) => {
      if (priorities.favorableAspects.includes(aspect.type)) {
        score += 3;
        const otherPlanet = aspect.planet1 === planetName ? aspect.planet2 : aspect.planet1;
        strengths.push(`${planetName} ${aspect.type} ${otherPlanet}`);
      } else if (priorities.unfavorableAspects.includes(aspect.type)) {
        score -= 2;
        const otherPlanet = aspect.planet1 === planetName ? aspect.planet2 : aspect.planet1;
        weaknesses.push(`${planetName} ${aspect.type} ${otherPlanet}`);
      }
    });

    if (priorities.importantHouses.includes(planet.house)) {
      score += 4;
      strengths.push(`${planetName} in House ${planet.house}`);
    }

    if (['Leo', 'Aries', 'Sagittarius'].includes(planet.sign) && planetName === 'Sun') {
      score += 3;
      strengths.push(`Sun in ${planet.sign} (strong placement)`);
    }

    if (['Cancer', 'Taurus', 'Pisces'].includes(planet.sign) && planetName === 'Moon') {
      score += 3;
      strengths.push(`Moon in ${planet.sign} (strong placement)`);
    }

    if (['Libra', 'Taurus', 'Pisces'].includes(planet.sign) && planetName === 'Venus') {
      score += 3;
      strengths.push(`Venus in ${planet.sign} (strong placement)`);
    }

    if (['Sagittarius', 'Pisces', 'Cancer'].includes(planet.sign) && planetName === 'Jupiter') {
      score += 3;
      strengths.push(`Jupiter in ${planet.sign} (strong placement)`);
    }
  });

  priorities.maleficPlanets.forEach((planetName) => {
    const planet = chart.planets.find((p) => p.name === planetName);
    if (!planet) return;

    const aspects = chart.aspects.filter((a) => a.planet1 === planetName || a.planet2 === planetName);

    aspects.forEach((aspect) => {
      const otherPlanet = aspect.planet1 === planetName ? aspect.planet2 : aspect.planet1;
      if (priorities.beneficPlanets.includes(otherPlanet) && priorities.unfavorableAspects.includes(aspect.type)) {
        score -= 4;
        weaknesses.push(`${planetName} ${aspect.type} ${otherPlanet}`);
      }
    });

    if (priorities.importantHouses.includes(planet.house)) {
      score -= 2;
      weaknesses.push(`${planetName} in House ${planet.house}`);
    }
  });

  const mercury = chart.planets.find((p) => p.name === 'Mercury');
  if (mercury && criteria.avoidRetrograde && isRetrograde(mercury)) {
    score -= 10;
    retrogradeWarnings.push('Mercury retrograde - communication and contracts challenged');
  }

  const ascSign = chart.planets.find((p) => p.name === 'Sun')?.sign || 'Aries';
  if (['Leo', 'Aries', 'Libra', 'Sagittarius'].includes(ascSign)) {
    score += 2;
    strengths.push('Favorable rising conditions');
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    strengths: strengths.slice(0, 5),
    weaknesses: weaknesses.slice(0, 5),
    retrogradeWarnings,
  };
}

function generateRecommendation(score: number, eventType: EventType): string {
  if (score >= 80) return `Excellent timing for ${eventType.replace('_', ' ')}. The planetary alignments strongly support this endeavor.`;
  if (score >= 65) return `Good timing for ${eventType.replace('_', ' ')}. Most planetary factors are favorable.`;
  if (score >= 50) return `Acceptable timing for ${eventType.replace('_', ' ')}. Mixed influences - proceed with awareness.`;
  if (score >= 35) return `Challenging timing for ${eventType.replace('_', ' ')}. Consider waiting for better alignments if possible.`;
  return `Not recommended timing for ${eventType.replace('_', ' ')}. Significant planetary challenges present.`;
}

export async function findOptimalTiming(
  criteria: ElectionCriteria,
  progressCallback?: (progress: number, current: number, total: number) => void,
): Promise<ElectionAnalysis> {
  const results: ElectionResult[] = [];

  const start = new Date(criteria.startDate);
  const end = new Date(criteria.endDate);

  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff > 90) {
    throw new Error('Date range cannot exceed 90 days');
  }

  const timesToCheck = criteria.timeRange
    ? [criteria.timeRange.start, '12:00', criteria.timeRange.end]
    : ['09:00', '12:00', '15:00', '18:00'];

  const totalChecks = daysDiff * timesToCheck.length;
  let currentCheck = 0;

  for (let i = 0; i <= daysDiff; i += 1) {
    const currentDate = new Date(start);
    currentDate.setDate(currentDate.getDate() + i);

    const dateStr = currentDate.toISOString().split('T')[0];

    for (const time of timesToCheck) {
      currentCheck += 1;

      if (progressCallback) {
        progressCallback(Math.round((currentCheck / totalChecks) * 100), currentCheck, totalChecks);
      }

      try {
        const chart = generateChartData({
          name: `Election ${dateStr} ${time}`,
          date: dateStr,
          time,
          location: criteria.location,
          latitude: criteria.latitude,
          longitude: criteria.longitude,
          timezone: criteria.timezone,
          coordinateSource: 'provided',
        });

        const sun = chart.planets.find((p) => p.name === 'Sun');
        const moon = chart.planets.find((p) => p.name === 'Moon');

        if (!sun || !moon) continue;

        const analysis = scoreChart(chart, criteria.eventType, criteria);
        const moonPhase = calculateMoonPhase(moon.longitude, sun.longitude);

        results.push({
          id: `election-${chart.id}`,
          date: dateStr,
          time,
          score: analysis.score,
          chart,
          strengths: analysis.strengths,
          weaknesses: analysis.weaknesses,
          recommendation: generateRecommendation(analysis.score, criteria.eventType),
          moonPhase,
          retrogradeWarnings: analysis.retrogradeWarnings,
        });
      } catch {
        // Skip candidate times that fail to generate (e.g. invalid date/time edge cases).
      }
    }
  }

  results.sort((a, b) => b.score - a.score);

  const bestDate = results[0] || null;

  return {
    criteria,
    results: results.slice(0, 20),
    bestDate,
    generatedAt: Date.now(),
  };
}

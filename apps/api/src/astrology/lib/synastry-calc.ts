import { ASPECT_TYPES, type ChartData } from '@pl-cms/shared';

export type RelationshipType = 'romantic' | 'friendship' | 'business';

export interface SynastryAspect {
  person1Planet: string;
  person2Planet: string;
  type: string;
  orb: number;
  angle: number;
  color: string;
  interpretation: 'harmonious' | 'challenging' | 'intense';
}

export interface CompatibilityScore {
  category: string;
  score: number;
  description: string;
  icon: string;
}

export interface SynastryData {
  person1: ChartData;
  person2: ChartData;
  aspects: SynastryAspect[];
  compatibilityScores: CompatibilityScore[];
  overallScore: number;
  relationshipType: RelationshipType;
  createdAt: number;
}

function calculateAspectAngle(long1: number, long2: number): number {
  let diff = Math.abs(long1 - long2);
  if (diff > 180) diff = 360 - diff;
  return diff;
}

function findAspectType(angle: number): { type: string; orb: number; color: string; name: string } | null {
  for (const [key, aspectInfo] of Object.entries(ASPECT_TYPES)) {
    const diff = Math.abs(angle - aspectInfo.angle);
    if (diff <= aspectInfo.orb) {
      return { type: key, orb: diff, color: aspectInfo.color, name: aspectInfo.name };
    }
  }
  return null;
}

function getAspectInterpretation(type: string): 'harmonious' | 'challenging' | 'intense' {
  if (type === 'trine' || type === 'sextile') return 'harmonious';
  if (type === 'square' || type === 'opposition') return 'challenging';
  return 'intense';
}

export function calculateSynastryAspects(chart1: ChartData, chart2: ChartData): SynastryAspect[] {
  const aspects: SynastryAspect[] = [];
  const majorPlanets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

  for (const p1 of chart1.planets) {
    if (!majorPlanets.includes(p1.name)) continue;

    for (const p2 of chart2.planets) {
      if (!majorPlanets.includes(p2.name)) continue;

      const angle = calculateAspectAngle(p1.longitude, p2.longitude);
      const aspectType = findAspectType(angle);

      if (aspectType) {
        aspects.push({
          person1Planet: p1.name,
          person2Planet: p2.name,
          type: aspectType.name,
          orb: aspectType.orb,
          angle,
          color: aspectType.color,
          interpretation: getAspectInterpretation(aspectType.type),
        });
      }
    }
  }

  return aspects.sort((a, b) => a.orb - b.orb);
}

export function calculateCompatibilityScores(
  chart1: ChartData,
  chart2: ChartData,
  aspects: SynastryAspect[],
  relationshipType: RelationshipType = 'romantic',
): CompatibilityScore[] {
  const scores: CompatibilityScore[] = [];

  const sunAspects = aspects.filter(
    (a) => (a.person1Planet === 'Sun' && a.person2Planet === 'Sun')
      || (a.person1Planet === 'Sun' && a.person2Planet === 'Moon')
      || (a.person2Planet === 'Sun' && a.person1Planet === 'Moon'),
  );
  const harmonious = sunAspects.filter((a) => a.interpretation === 'harmonious').length;
  const challenging = sunAspects.filter((a) => a.interpretation === 'challenging').length;
  const coreScore = Math.min(100, harmonious * 25 - challenging * 10 + 50);

  scores.push({
    category: 'Core Connection',
    score: Math.max(0, coreScore),
    description: coreScore > 70 ? 'Strong fundamental compatibility' : coreScore > 40 ? 'Moderate core connection' : 'Challenging foundation',
    icon: '☉',
  });

  const mercuryAspects = aspects.filter((a) => a.person1Planet === 'Mercury' || a.person2Planet === 'Mercury');
  const mercuryHarmonious = mercuryAspects.filter((a) => a.interpretation === 'harmonious').length;
  const mercuryChallenging = mercuryAspects.filter((a) => a.interpretation === 'challenging').length;
  const commScore = Math.min(100, mercuryHarmonious * 20 - mercuryChallenging * 10 + 50);

  scores.push({
    category: 'Communication',
    score: Math.max(0, commScore),
    description: commScore > 70 ? 'Excellent mental rapport' : commScore > 40 ? 'Fair communication' : 'Misunderstandings likely',
    icon: '☿',
  });

  if (relationshipType === 'romantic') {
    const venusAspects = aspects.filter((a) => a.person1Planet === 'Venus' || a.person2Planet === 'Venus');
    const venusHarmonious = venusAspects.filter((a) => a.interpretation === 'harmonious').length;
    const venusChallenging = venusAspects.filter((a) => a.interpretation === 'challenging').length;
    const romanticScore = Math.min(100, venusHarmonious * 20 - venusChallenging * 8 + 50);

    scores.push({
      category: 'Romantic Attraction',
      score: Math.max(0, romanticScore),
      description: romanticScore > 70 ? 'Powerful romantic chemistry' : romanticScore > 40 ? 'Decent attraction' : 'Limited romantic spark',
      icon: '♀',
    });

    const marsAspects = aspects.filter((a) => a.person1Planet === 'Mars' || a.person2Planet === 'Mars');
    const marsIntense = marsAspects.filter((a) => a.interpretation === 'intense').length;
    const marsHarmonious = marsAspects.filter((a) => a.interpretation === 'harmonious').length;
    const passionScore = Math.min(100, marsIntense * 15 + marsHarmonious * 15 + 40);

    scores.push({
      category: 'Passion & Energy',
      score: Math.max(0, passionScore),
      description: passionScore > 70 ? 'Intense physical chemistry' : passionScore > 40 ? 'Moderate passion' : 'Low energy exchange',
      icon: '♂',
    });

    const jupiterSaturnAspects = aspects.filter(
      (a) => a.person1Planet === 'Jupiter' || a.person2Planet === 'Jupiter' || a.person1Planet === 'Saturn' || a.person2Planet === 'Saturn',
    );
    const longTermHarmonious = jupiterSaturnAspects.filter((a) => a.interpretation === 'harmonious').length;
    const longTermScore = Math.min(100, longTermHarmonious * 15 + 40);

    scores.push({
      category: 'Long-term Potential',
      score: Math.max(0, longTermScore),
      description: longTermScore > 70 ? 'Strong commitment indicators' : longTermScore > 40 ? 'Moderate stability' : 'Uncertain longevity',
      icon: '♄',
    });

    const moonAspects = aspects.filter((a) => a.person1Planet === 'Moon' || a.person2Planet === 'Moon');
    const moonHarmonious = moonAspects.filter((a) => a.interpretation === 'harmonious').length;
    const moonChallenging = moonAspects.filter((a) => a.interpretation === 'challenging').length;
    const emotionalScore = Math.min(100, moonHarmonious * 22 - moonChallenging * 12 + 50);

    scores.push({
      category: 'Emotional Intimacy',
      score: Math.max(0, emotionalScore),
      description: emotionalScore > 70 ? 'Deep emotional understanding' : emotionalScore > 40 ? 'Moderate emotional connection' : 'Emotional disconnect',
      icon: '☽',
    });
  } else if (relationshipType === 'friendship') {
    const moonAspects = aspects.filter((a) => a.person1Planet === 'Moon' || a.person2Planet === 'Moon');
    const moonHarmonious = moonAspects.filter((a) => a.interpretation === 'harmonious').length;
    const moonChallenging = moonAspects.filter((a) => a.interpretation === 'challenging').length;
    const emotionalScore = Math.min(100, moonHarmonious * 22 - moonChallenging * 12 + 50);

    scores.push({
      category: 'Emotional Support',
      score: Math.max(0, emotionalScore),
      description: emotionalScore > 70 ? 'Strong emotional support system' : emotionalScore > 40 ? 'Decent mutual understanding' : 'Limited emotional rapport',
      icon: '☽',
    });

    const jupiterAspects = aspects.filter((a) => a.person1Planet === 'Jupiter' || a.person2Planet === 'Jupiter');
    const jupiterHarmonious = jupiterAspects.filter((a) => a.interpretation === 'harmonious').length;
    const funScore = Math.min(100, jupiterHarmonious * 25 + 40);

    scores.push({
      category: 'Fun & Adventure',
      score: Math.max(0, funScore),
      description: funScore > 70 ? 'Great companions for adventure' : funScore > 40 ? 'Moderate enjoyment together' : 'Different interests',
      icon: '♃',
    });

    const saturnAspects = aspects.filter((a) => a.person1Planet === 'Saturn' || a.person2Planet === 'Saturn');
    const saturnHarmonious = saturnAspects.filter((a) => a.interpretation === 'harmonious').length;
    const saturnChallenging = saturnAspects.filter((a) => a.interpretation === 'challenging').length;
    const loyaltyScore = Math.min(100, saturnHarmonious * 20 - saturnChallenging * 5 + 50);

    scores.push({
      category: 'Loyalty & Trust',
      score: Math.max(0, loyaltyScore),
      description: loyaltyScore > 70 ? 'Deeply trustworthy friendship' : loyaltyScore > 40 ? 'Reliable connection' : 'Trust needs work',
      icon: '♄',
    });

    const venusAspects = aspects.filter((a) => a.person1Planet === 'Venus' || a.person2Planet === 'Venus');
    const venusHarmonious = venusAspects.filter((a) => a.interpretation === 'harmonious').length;
    const socialScore = Math.min(100, venusHarmonious * 22 + 40);

    scores.push({
      category: 'Social Harmony',
      score: Math.max(0, socialScore),
      description: socialScore > 70 ? 'Excellent social compatibility' : socialScore > 40 ? 'Generally get along well' : 'Different social styles',
      icon: '♀',
    });
  } else if (relationshipType === 'business') {
    const saturnAspects = aspects.filter((a) => a.person1Planet === 'Saturn' || a.person2Planet === 'Saturn');
    const saturnHarmonious = saturnAspects.filter((a) => a.interpretation === 'harmonious').length;
    const saturnChallenging = saturnAspects.filter((a) => a.interpretation === 'challenging').length;
    const professionalScore = Math.min(100, saturnHarmonious * 22 - saturnChallenging * 8 + 50);

    scores.push({
      category: 'Professionalism',
      score: Math.max(0, professionalScore),
      description: professionalScore > 70 ? 'Excellent work discipline alignment' : professionalScore > 40 ? 'Workable professional dynamic' : 'Conflicting work styles',
      icon: '♄',
    });

    const marsAspects = aspects.filter((a) => a.person1Planet === 'Mars' || a.person2Planet === 'Mars');
    const marsHarmonious = marsAspects.filter((a) => a.interpretation === 'harmonious').length;
    const marsChallenging = marsAspects.filter((a) => a.interpretation === 'challenging').length;
    const driveScore = Math.min(100, marsHarmonious * 20 - marsChallenging * 12 + 50);

    scores.push({
      category: 'Ambition & Drive',
      score: Math.max(0, driveScore),
      description: driveScore > 70 ? 'Aligned goals and motivation' : driveScore > 40 ? 'Compatible work ethic' : 'Mismatched ambitions',
      icon: '♂',
    });

    const jupiterAspects = aspects.filter((a) => a.person1Planet === 'Jupiter' || a.person2Planet === 'Jupiter');
    const jupiterHarmonious = jupiterAspects.filter((a) => a.interpretation === 'harmonious').length;
    const growthScore = Math.min(100, jupiterHarmonious * 25 + 40);

    scores.push({
      category: 'Growth Potential',
      score: Math.max(0, growthScore),
      description: growthScore > 70 ? 'Mutual growth and prosperity' : growthScore > 40 ? 'Some opportunities for growth' : 'Limited expansion together',
      icon: '♃',
    });

    const venusAspects = aspects.filter((a) => a.person1Planet === 'Venus' || a.person2Planet === 'Venus');
    const venusHarmonious = venusAspects.filter((a) => a.interpretation === 'harmonious').length;
    const diplomaticScore = Math.min(100, venusHarmonious * 20 + 45);

    scores.push({
      category: 'Diplomatic Relations',
      score: Math.max(0, diplomaticScore),
      description: diplomaticScore > 70 ? 'Smooth negotiations and agreements' : diplomaticScore > 40 ? 'Manageable conflicts' : 'Frequent disagreements',
      icon: '♀',
    });
  }

  return scores;
}

export function calculateOverallCompatibility(scores: CompatibilityScore[], relationshipType: RelationshipType): number {
  let weights: Record<string, number> = {};

  if (relationshipType === 'romantic') {
    weights = {
      'Core Connection': 0.2,
      Communication: 0.15,
      'Romantic Attraction': 0.25,
      'Passion & Energy': 0.2,
      'Long-term Potential': 0.12,
      'Emotional Intimacy': 0.18,
    };
  } else if (relationshipType === 'friendship') {
    weights = {
      'Core Connection': 0.2,
      Communication: 0.25,
      'Emotional Support': 0.2,
      'Fun & Adventure': 0.18,
      'Loyalty & Trust': 0.12,
      'Social Harmony': 0.15,
    };
  } else if (relationshipType === 'business') {
    weights = {
      'Core Connection': 0.15,
      Communication: 0.3,
      Professionalism: 0.25,
      'Ambition & Drive': 0.18,
      'Growth Potential': 0.12,
      'Diplomatic Relations': 0.1,
    };
  }

  let totalScore = 0;
  for (const score of scores) {
    const weight = weights[score.category] || 0.2;
    totalScore += score.score * weight;
  }

  return Math.round(totalScore);
}

export function generateSynastryData(
  chart1: ChartData,
  chart2: ChartData,
  relationshipType: RelationshipType = 'romantic',
): SynastryData {
  const aspects = calculateSynastryAspects(chart1, chart2);
  const compatibilityScores = calculateCompatibilityScores(chart1, chart2, aspects, relationshipType);
  const overallScore = calculateOverallCompatibility(compatibilityScores, relationshipType);

  return {
    person1: chart1,
    person2: chart2,
    aspects,
    compatibilityScores,
    overallScore,
    relationshipType,
    createdAt: Date.now(),
  };
}

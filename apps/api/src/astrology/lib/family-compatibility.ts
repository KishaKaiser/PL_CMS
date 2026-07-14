import { ASPECT_TYPES, type ChartData } from '@pl-cms/shared';

export type FamilyRelationType = 'parent-child' | 'sibling';

export interface FamilyAspect {
  person1Planet: string;
  person2Planet: string;
  type: string;
  orb: number;
  angle: number;
  color: string;
  interpretation: 'harmonious' | 'challenging' | 'intense';
}

export interface FamilyCompatibilityScore {
  category: string;
  score: number;
  description: string;
  icon: string;
}

export interface FamilyRelationshipData {
  person1: ChartData;
  person2: ChartData;
  aspects: FamilyAspect[];
  compatibilityScores: FamilyCompatibilityScore[];
  overallScore: number;
  relationshipType: FamilyRelationType;
  createdAt: number;
  aiInterpretation?: string;
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

export function calculateFamilyAspects(chart1: ChartData, chart2: ChartData): FamilyAspect[] {
  const aspects: FamilyAspect[] = [];
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

export function calculateFamilyScores(
  chart1: ChartData,
  chart2: ChartData,
  aspects: FamilyAspect[],
  relationshipType: FamilyRelationType,
): FamilyCompatibilityScore[] {
  const scores: FamilyCompatibilityScore[] = [];

  if (relationshipType === 'parent-child') {
    const moonAspects = aspects.filter((a) => a.person1Planet === 'Moon' || a.person2Planet === 'Moon');
    const moonHarmonious = moonAspects.filter((a) => a.interpretation === 'harmonious').length;
    const moonChallenging = moonAspects.filter((a) => a.interpretation === 'challenging').length;
    const emotionalScore = Math.min(100, moonHarmonious * 25 - moonChallenging * 10 + 50);

    scores.push({
      category: 'Emotional Bond',
      score: Math.max(0, emotionalScore),
      description: emotionalScore > 75 ? 'Deep intuitive understanding between parent and child' : emotionalScore > 50 ? 'Good emotional connection with room to grow' : 'Emotional expression styles differ significantly',
      icon: '☽',
    });

    const mercuryAspects = aspects.filter((a) => a.person1Planet === 'Mercury' || a.person2Planet === 'Mercury');
    const mercuryHarmonious = mercuryAspects.filter((a) => a.interpretation === 'harmonious').length;
    const mercuryChallenging = mercuryAspects.filter((a) => a.interpretation === 'challenging').length;
    const commScore = Math.min(100, mercuryHarmonious * 20 - mercuryChallenging * 10 + 50);

    scores.push({
      category: 'Communication',
      score: Math.max(0, commScore),
      description: commScore > 75 ? 'Parent and child naturally understand each other' : commScore > 50 ? 'Communication flows with effort' : 'Different communication wavelengths',
      icon: '☿',
    });

    const venusAspects = aspects.filter((a) => a.person1Planet === 'Venus' || a.person2Planet === 'Venus');
    const venusHarmonious = venusAspects.filter((a) => a.interpretation === 'harmonious').length;
    const venusScore = Math.min(100, venusHarmonious * 22 + 45);

    scores.push({
      category: 'Affection & Warmth',
      score: Math.max(0, venusScore),
      description: venusScore > 75 ? 'Natural expressions of love and appreciation' : venusScore > 50 ? 'Affection shown in different ways' : 'Love languages may differ',
      icon: '♀',
    });

    const sunAspects = aspects.filter(
      (a) => (a.person1Planet === 'Sun' && a.person2Planet === 'Sun')
        || (a.person1Planet === 'Sun' && a.person2Planet === 'Moon')
        || (a.person2Planet === 'Sun' && a.person1Planet === 'Moon'),
    );
    const sunHarmonious = sunAspects.filter((a) => a.interpretation === 'harmonious').length;
    const sunChallenging = sunAspects.filter((a) => a.interpretation === 'challenging').length;
    const identityScore = Math.min(100, sunHarmonious * 25 - sunChallenging * 12 + 50);

    scores.push({
      category: 'Identity Support',
      score: Math.max(0, identityScore),
      description: identityScore > 75 ? 'Parent naturally supports child\'s authentic self' : identityScore > 50 ? 'Growing acceptance of individuality' : 'Potential identity conflicts',
      icon: '☉',
    });

    const jupiterAspects = aspects.filter((a) => a.person1Planet === 'Jupiter' || a.person2Planet === 'Jupiter');
    const jupiterHarmonious = jupiterAspects.filter((a) => a.interpretation === 'harmonious').length;
    const growthScore = Math.min(100, jupiterHarmonious * 22 + 45);

    scores.push({
      category: 'Learning & Growth',
      score: Math.max(0, growthScore),
      description: growthScore > 75 ? 'Parent inspires child\'s natural curiosity and expansion' : growthScore > 50 ? 'Opportunities for mutual learning' : 'Different learning approaches',
      icon: '♃',
    });

    const saturnAspects = aspects.filter((a) => a.person1Planet === 'Saturn' || a.person2Planet === 'Saturn');
    const saturnHarmonious = saturnAspects.filter((a) => a.interpretation === 'harmonious').length;
    const saturnChallenging = saturnAspects.filter((a) => a.interpretation === 'challenging').length;
    const structureScore = Math.min(100, saturnHarmonious * 20 - saturnChallenging * 8 + 50);

    scores.push({
      category: 'Discipline & Structure',
      score: Math.max(0, structureScore),
      description: structureScore > 75 ? 'Balanced guidance and boundaries work well' : structureScore > 50 ? 'Discipline needs adjustment over time' : 'Authority and freedom need careful navigation',
      icon: '♄',
    });

    const marsAspects = aspects.filter((a) => a.person1Planet === 'Mars' || a.person2Planet === 'Mars');
    const marsHarmonious = marsAspects.filter((a) => a.interpretation === 'harmonious').length;
    const marsChallenging = marsAspects.filter((a) => a.interpretation === 'challenging').length;
    const energyScore = Math.min(100, marsHarmonious * 18 - marsChallenging * 15 + 50);

    scores.push({
      category: 'Energy & Activity',
      score: Math.max(0, energyScore),
      description: energyScore > 75 ? 'Compatible activity levels and interests' : energyScore > 50 ? 'Some shared activities possible' : 'Different energy rhythms and preferences',
      icon: '♂',
    });
  } else {
    const sunAspects = aspects.filter(
      (a) => (a.person1Planet === 'Sun' && a.person2Planet === 'Sun')
        || (a.person1Planet === 'Sun' && a.person2Planet === 'Moon')
        || (a.person2Planet === 'Sun' && a.person1Planet === 'Moon'),
    );
    const sunHarmonious = sunAspects.filter((a) => a.interpretation === 'harmonious').length;
    const sunChallenging = sunAspects.filter((a) => a.interpretation === 'challenging').length;
    const coreScore = Math.min(100, sunHarmonious * 25 - sunChallenging * 10 + 50);

    scores.push({
      category: 'Core Connection',
      score: Math.max(0, coreScore),
      description: coreScore > 75 ? 'Natural allies who understand each other deeply' : coreScore > 50 ? 'Good foundation with some differences' : 'Very different personalities',
      icon: '☉',
    });

    const moonAspects = aspects.filter((a) => a.person1Planet === 'Moon' || a.person2Planet === 'Moon');
    const moonHarmonious = moonAspects.filter((a) => a.interpretation === 'harmonious').length;
    const moonChallenging = moonAspects.filter((a) => a.interpretation === 'challenging').length;
    const emotionalScore = Math.min(100, moonHarmonious * 25 - moonChallenging * 10 + 50);

    scores.push({
      category: 'Emotional Understanding',
      score: Math.max(0, emotionalScore),
      description: emotionalScore > 75 ? 'Siblings intuitively understand each other\'s feelings' : emotionalScore > 50 ? 'Can relate emotionally with effort' : 'Different emotional needs and expressions',
      icon: '☽',
    });

    const mercuryAspects = aspects.filter((a) => a.person1Planet === 'Mercury' || a.person2Planet === 'Mercury');
    const mercuryHarmonious = mercuryAspects.filter((a) => a.interpretation === 'harmonious').length;
    const mercuryChallenging = mercuryAspects.filter((a) => a.interpretation === 'challenging').length;
    const commScore = Math.min(100, mercuryHarmonious * 20 - mercuryChallenging * 10 + 50);

    scores.push({
      category: 'Communication',
      score: Math.max(0, commScore),
      description: commScore > 75 ? 'Easy conversation and mutual understanding' : commScore > 50 ? 'Can communicate with patience' : 'Frequent misunderstandings',
      icon: '☿',
    });

    const marsAspects = aspects.filter((a) => a.person1Planet === 'Mars' || a.person2Planet === 'Mars');
    const marsHarmonious = marsAspects.filter((a) => a.interpretation === 'harmonious').length;
    const marsChallenging = marsAspects.filter((a) => a.interpretation === 'challenging').length;
    const marsIntense = marsAspects.filter((a) => a.interpretation === 'intense').length;
    const competitionScore = 50 - marsChallenging * 8 - marsIntense * 5 + marsHarmonious * 12;

    scores.push({
      category: 'Competition vs Cooperation',
      score: Math.max(0, Math.min(100, competitionScore)),
      description: competitionScore > 75 ? 'Natural teamwork and mutual support' : competitionScore > 50 ? 'Some rivalry but generally cooperative' : 'Strong competitive dynamic or conflicts',
      icon: '♂',
    });

    const jupiterAspects = aspects.filter((a) => a.person1Planet === 'Jupiter' || a.person2Planet === 'Jupiter');
    const jupiterHarmonious = jupiterAspects.filter((a) => a.interpretation === 'harmonious').length;
    const sharedInterestScore = Math.min(100, jupiterHarmonious * 22 + 45);

    scores.push({
      category: 'Shared Interests',
      score: Math.max(0, sharedInterestScore),
      description: sharedInterestScore > 75 ? 'Many common interests and activities' : sharedInterestScore > 50 ? 'Some shared hobbies and fun' : 'Different interests and pursuits',
      icon: '♃',
    });

    const saturnAspects = aspects.filter((a) => a.person1Planet === 'Saturn' || a.person2Planet === 'Saturn');
    const saturnHarmonious = saturnAspects.filter((a) => a.interpretation === 'harmonious').length;
    const saturnChallenging = saturnAspects.filter((a) => a.interpretation === 'challenging').length;
    const supportScore = Math.min(100, saturnHarmonious * 20 - saturnChallenging * 8 + 50);

    scores.push({
      category: 'Mutual Support',
      score: Math.max(0, supportScore),
      description: supportScore > 75 ? 'Reliable support through life\'s challenges' : supportScore > 50 ? 'Can depend on each other when needed' : 'May struggle to support each other consistently',
      icon: '♄',
    });

    const venusAspects = aspects.filter((a) => a.person1Planet === 'Venus' || a.person2Planet === 'Venus');
    const venusHarmonious = venusAspects.filter((a) => a.interpretation === 'harmonious').length;
    const affectionScore = Math.min(100, venusHarmonious * 22 + 45);

    scores.push({
      category: 'Affection & Harmony',
      score: Math.max(0, affectionScore),
      description: affectionScore > 75 ? 'Easy affection and general harmony' : affectionScore > 50 ? 'Can show care in different ways' : 'Affection may feel awkward or rare',
      icon: '♀',
    });
  }

  return scores;
}

export function calculateOverallFamilyScore(scores: FamilyCompatibilityScore[], relationshipType: FamilyRelationType): number {
  let weights: Record<string, number> = {};

  if (relationshipType === 'parent-child') {
    weights = {
      'Emotional Bond': 0.25,
      Communication: 0.2,
      'Affection & Warmth': 0.15,
      'Identity Support': 0.15,
      'Learning & Growth': 0.1,
      'Discipline & Structure': 0.1,
      'Energy & Activity': 0.05,
    };
  } else {
    weights = {
      'Core Connection': 0.2,
      'Emotional Understanding': 0.2,
      Communication: 0.15,
      'Competition vs Cooperation': 0.15,
      'Shared Interests': 0.12,
      'Mutual Support': 0.1,
      'Affection & Harmony': 0.08,
    };
  }

  let weightedSum = 0;
  let totalWeight = 0;

  for (const score of scores) {
    const weight = weights[score.category] || 0.1;
    weightedSum += score.score * weight;
    totalWeight += weight;
  }

  return Math.round(weightedSum / totalWeight);
}

export function generateFamilyAnalysis(
  chart1: ChartData,
  chart2: ChartData,
  relationshipType: FamilyRelationType,
): FamilyRelationshipData {
  const aspects = calculateFamilyAspects(chart1, chart2);
  const scores = calculateFamilyScores(chart1, chart2, aspects, relationshipType);
  const overallScore = calculateOverallFamilyScore(scores, relationshipType);

  return {
    person1: chart1,
    person2: chart2,
    aspects,
    compatibilityScores: scores,
    overallScore,
    relationshipType,
    createdAt: Date.now(),
  };
}

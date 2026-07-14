import type { ChartData } from '@pl-cms/shared';
import type { SynastryAspect } from './synastry-calc';

export interface SoulmateIndicator {
  type: 'twin-flame' | 'soulmate' | 'karmic' | 'divine-partner';
  name: string;
  description: string;
  strength: number;
  present: boolean;
  details?: string;
}

export interface SoulmateAnalysis {
  isTwinFlame: boolean;
  isSoulmate: boolean;
  twinFlameScore: number;
  soulmateScore: number;
  connectionType: 'Twin Flame' | 'Soulmate' | 'Karmic Soulmate' | 'Divine Partnership' | 'Strong Connection' | 'Moderate Connection';
  indicators: SoulmateIndicator[];
  summary: string;
}

function calculateAspectAngle(long1: number, long2: number): number {
  let diff = Math.abs(long1 - long2);
  if (diff > 180) diff = 360 - diff;
  return diff;
}

function checkConjunction(long1: number, long2: number, orb = 8): boolean {
  return calculateAspectAngle(long1, long2) <= orb;
}

function checkOpposition(long1: number, long2: number, orb = 8): boolean {
  const angle = Math.abs(long1 - long2);
  const diff = Math.abs(angle - 180);
  return diff <= orb || Math.abs(360 - angle - 180) <= orb;
}

function checkTrine(long1: number, long2: number, orb = 8): boolean {
  const angle = calculateAspectAngle(long1, long2);
  return Math.abs(angle - 120) <= orb || Math.abs(angle - 240) <= orb;
}

function getPlanetLongitude(chart: ChartData, planetName: string): number | null {
  const planet = chart.planets.find((p) => p.name === planetName);
  return planet ? planet.longitude : null;
}

function getNodeLongitude(chart: ChartData, nodeName: 'North Node' | 'South Node'): number | null {
  const node = chart.planets.find((p) => p.name === nodeName);
  return node ? node.longitude : null;
}

export function analyzeSoulmateConnection(
  chart1: ChartData,
  chart2: ChartData,
  aspects: SynastryAspect[],
): SoulmateAnalysis {
  const indicators: SoulmateIndicator[] = [];
  let twinFlameScore = 0;
  let soulmateScore = 0;

  const sun1 = getPlanetLongitude(chart1, 'Sun');
  const sun2 = getPlanetLongitude(chart2, 'Sun');
  const moon1 = getPlanetLongitude(chart1, 'Moon');
  const moon2 = getPlanetLongitude(chart2, 'Moon');
  const venus1 = getPlanetLongitude(chart1, 'Venus');
  const venus2 = getPlanetLongitude(chart2, 'Venus');
  const mars1 = getPlanetLongitude(chart1, 'Mars');
  const mars2 = getPlanetLongitude(chart2, 'Mars');
  const northNode1 = getNodeLongitude(chart1, 'North Node');
  const northNode2 = getNodeLongitude(chart2, 'North Node');
  const southNode1 = getNodeLongitude(chart1, 'South Node');
  const southNode2 = getNodeLongitude(chart2, 'South Node');

  if (sun1 && moon2 && checkConjunction(sun1, moon2)) {
    indicators.push({
      type: 'soulmate',
      name: 'Sun-Moon Conjunction',
      description: 'One person\'s Sun conjunct the other\'s Moon - a classic soulmate indicator',
      strength: 95,
      present: true,
      details: 'This is the ultimate complementary aspect. Your essence (Sun) perfectly nurtures their emotional needs (Moon), creating deep soul recognition.',
    });
    soulmateScore += 20;
    twinFlameScore += 15;
  }

  if (moon1 && sun2 && checkConjunction(moon1, sun2)) {
    indicators.push({
      type: 'soulmate',
      name: 'Moon-Sun Conjunction',
      description: 'Your Moon conjunct their Sun - emotional and spiritual harmony',
      strength: 95,
      present: true,
      details: 'Your emotional nature resonates perfectly with their core identity, creating instant understanding and comfort.',
    });
    soulmateScore += 20;
    twinFlameScore += 15;
  }

  if (moon1 && moon2 && checkConjunction(moon1, moon2)) {
    indicators.push({
      type: 'soulmate',
      name: 'Moon-Moon Conjunction',
      description: 'Identical emotional wavelength and intuitive understanding',
      strength: 90,
      present: true,
      details: 'Your emotional needs and responses are remarkably similar, creating effortless emotional intimacy and mutual understanding.',
    });
    soulmateScore += 18;
    twinFlameScore += 12;
  }

  if (sun1 && sun2 && checkConjunction(sun1, sun2)) {
    indicators.push({
      type: 'twin-flame',
      name: 'Sun-Sun Conjunction',
      description: 'Born under the same sun - mirror souls sharing the same life force',
      strength: 88,
      present: true,
      details: 'You share the same core essence and life purpose. This is a powerful twin flame indicator of two souls from the same source.',
    });
    twinFlameScore += 18;
    soulmateScore += 10;
  }

  if (venus1 && venus2 && checkConjunction(venus1, venus2)) {
    indicators.push({
      type: 'soulmate',
      name: 'Venus-Venus Conjunction',
      description: 'Identical love languages and relationship values',
      strength: 85,
      present: true,
      details: 'You express and receive love in the same way, share the same aesthetic sense, and value the same qualities in relationships.',
    });
    soulmateScore += 15;
    twinFlameScore += 10;
  }

  if (sun1 && northNode2 && checkConjunction(sun1, northNode2)) {
    indicators.push({
      type: 'karmic',
      name: 'Sun-North Node Connection',
      description: 'You illuminate their destiny path - divine purpose alignment',
      strength: 92,
      present: true,
      details: 'Your very essence helps them fulfill their life purpose. This is a destined meeting to help them grow into their highest potential.',
    });
    soulmateScore += 16;
    twinFlameScore += 14;
  }

  if (sun2 && northNode1 && checkConjunction(sun2, northNode1)) {
    indicators.push({
      type: 'karmic',
      name: 'Their Sun on Your North Node',
      description: 'They illuminate your destiny - you are meant to learn from them',
      strength: 92,
      present: true,
      details: 'Their presence in your life is destined to guide you toward your soul\'s purpose. They represent what you came here to become.',
    });
    soulmateScore += 16;
    twinFlameScore += 14;
  }

  if (moon1 && northNode2 && checkConjunction(moon1, northNode2)) {
    indicators.push({
      type: 'karmic',
      name: 'Moon-North Node Bond',
      description: 'Your emotional nature supports their soul growth',
      strength: 88,
      present: true,
      details: 'You naturally know how to nurture and support their highest evolution. This connection feels familiar yet transformative.',
    });
    soulmateScore += 14;
    twinFlameScore += 12;
  }

  if (moon2 && northNode1 && checkConjunction(moon2, northNode1)) {
    indicators.push({
      type: 'karmic',
      name: 'Their Moon on Your North Node',
      description: 'They emotionally support your destiny path',
      strength: 88,
      present: true,
      details: 'They instinctively understand what you need emotionally to fulfill your life purpose. Their presence feels like coming home.',
    });
    soulmateScore += 14;
    twinFlameScore += 12;
  }

  if (venus1 && mars2 && checkConjunction(venus1, mars2)) {
    indicators.push({
      type: 'divine-partner',
      name: 'Venus-Mars Conjunction',
      description: 'Perfect romantic and physical chemistry - magnetic attraction',
      strength: 93,
      present: true,
      details: 'Your feminine energy perfectly complements their masculine drive, creating intense romantic and sexual attraction.',
    });
    soulmateScore += 17;
    twinFlameScore += 12;
  }

  if (mars1 && venus2 && checkConjunction(mars1, venus2)) {
    indicators.push({
      type: 'divine-partner',
      name: 'Mars-Venus Conjunction',
      description: 'Powerful magnetic attraction and romantic chemistry',
      strength: 93,
      present: true,
      details: 'Your assertive energy ignites their heart, creating passionate attraction and deep romantic connection.',
    });
    soulmateScore += 17;
    twinFlameScore += 12;
  }

  if (northNode1 && southNode2 && checkConjunction(northNode1, southNode2)) {
    indicators.push({
      type: 'karmic',
      name: 'Nodal Axis Connection',
      description: 'Past life connection - your destiny is their past, creating karmic recognition',
      strength: 94,
      present: true,
      details: 'Strong past life bond. Where you\'re going is where they\'ve been. This creates instant recognition and karmic lessons to complete.',
    });
    soulmateScore += 18;
    twinFlameScore += 16;
  }

  if (northNode2 && southNode1 && checkConjunction(northNode2, southNode1)) {
    indicators.push({
      type: 'karmic',
      name: 'Reversed Nodal Connection',
      description: 'Past life bond - their destiny is your past',
      strength: 94,
      present: true,
      details: 'Where they\'re going is where you\'ve been. You can guide them, and they help you release old patterns.',
    });
    soulmateScore += 18;
    twinFlameScore += 16;
  }

  if (sun1 && sun2 && checkOpposition(sun1, sun2)) {
    indicators.push({
      type: 'twin-flame',
      name: 'Sun Opposition',
      description: 'Perfect polarity - two halves of the same whole',
      strength: 91,
      present: true,
      details: 'Classic twin flame aspect. You are opposite yet complementary, like two sides of the same coin. This creates both attraction and challenge.',
    });
    twinFlameScore += 20;
    soulmateScore += 12;
  }

  if (moon1 && moon2 && checkOpposition(moon1, moon2)) {
    indicators.push({
      type: 'twin-flame',
      name: 'Moon Opposition',
      description: 'Emotional polarity - you complete each other emotionally',
      strength: 87,
      present: true,
      details: 'You express emotions in opposite ways, yet this creates perfect balance. What one lacks, the other provides.',
    });
    twinFlameScore += 16;
    soulmateScore += 10;
  }

  if (venus1 && venus2 && checkTrine(venus1, venus2)) {
    indicators.push({
      type: 'soulmate',
      name: 'Venus Trine',
      description: 'Harmonious love expression and shared values',
      strength: 82,
      present: true,
      details: 'Your ways of loving flow together effortlessly. You appreciate the same things and create beauty together naturally.',
    });
    soulmateScore += 13;
    twinFlameScore += 8;
  }

  if (moon1 && moon2 && checkTrine(moon1, moon2)) {
    indicators.push({
      type: 'soulmate',
      name: 'Moon Trine',
      description: 'Effortless emotional harmony and nurturing',
      strength: 84,
      present: true,
      details: 'Emotional understanding flows naturally. You instinctively know how to comfort and support each other.',
    });
    soulmateScore += 14;
    twinFlameScore += 9;
  }

  if (sun1 && moon2 && checkTrine(sun1, moon2)) {
    indicators.push({
      type: 'soulmate',
      name: 'Sun-Moon Trine',
      description: 'Harmonious soul connection - easy compatibility',
      strength: 86,
      present: true,
      details: 'Your essence supports their emotional needs harmoniously. This relationship feels natural and comfortable.',
    });
    soulmateScore += 15;
    twinFlameScore += 10;
  }

  if (moon1 && sun2 && checkTrine(moon1, sun2)) {
    indicators.push({
      type: 'soulmate',
      name: 'Moon-Sun Trine',
      description: 'Your emotions harmonize with their core self',
      strength: 86,
      present: true,
      details: 'You emotionally resonate with who they are at their core. Understanding comes naturally.',
    });
    soulmateScore += 15;
    twinFlameScore += 10;
  }

  if (mars1 && mars2 && checkConjunction(mars1, mars2)) {
    indicators.push({
      type: 'twin-flame',
      name: 'Mars-Mars Conjunction',
      description: 'Identical drive and passion - united warrior energy',
      strength: 80,
      present: true,
      details: 'You fight for the same things and channel energy the same way. This creates powerful synergy or intense conflict.',
    });
    twinFlameScore += 14;
    soulmateScore += 8;
  }

  if (venus1 && northNode2 && checkConjunction(venus1, northNode2)) {
    indicators.push({
      type: 'divine-partner',
      name: 'Venus-North Node Connection',
      description: 'Your love helps them grow into their destiny',
      strength: 89,
      present: true,
      details: 'The way you love and value them is exactly what they need to fulfill their life purpose.',
    });
    soulmateScore += 15;
    twinFlameScore += 11;
  }

  if (venus2 && northNode1 && checkConjunction(venus2, northNode1)) {
    indicators.push({
      type: 'divine-partner',
      name: 'Their Venus on Your North Node',
      description: 'Their love guides you toward your destiny',
      strength: 89,
      present: true,
      details: 'Being loved by them helps you become who you\'re meant to be. Their affection nurtures your soul growth.',
    });
    soulmateScore += 15;
    twinFlameScore += 11;
  }

  const ascendant1 = chart1.houses[0]?.cusp;
  const ascendant2 = chart2.houses[0]?.cusp;

  if (ascendant1 && ascendant2 && checkConjunction(ascendant1, ascendant2)) {
    indicators.push({
      type: 'twin-flame',
      name: 'Ascendant Conjunction',
      description: 'You face life in the same way - identical life approach',
      strength: 83,
      present: true,
      details: 'Your outward personalities and life approaches are remarkably similar. You understand each other\'s perspective instantly.',
    });
    twinFlameScore += 12;
    soulmateScore += 8;
  }

  if (sun1 && ascendant2 && checkConjunction(sun1, ascendant2)) {
    indicators.push({
      type: 'soulmate',
      name: 'Sun-Ascendant Connection',
      description: 'Your essence aligns with how they present themselves',
      strength: 81,
      present: true,
      details: 'Who you are at your core matches how they approach life. This creates natural compatibility and mutual respect.',
    });
    soulmateScore += 12;
    twinFlameScore += 8;
  }

  if (sun2 && ascendant1 && checkConjunction(sun2, ascendant1)) {
    indicators.push({
      type: 'soulmate',
      name: 'Their Sun on Your Ascendant',
      description: 'They light up your life path',
      strength: 81,
      present: true,
      details: 'Their presence energizes you and makes you feel more alive. They help you express yourself more authentically.',
    });
    soulmateScore += 12;
    twinFlameScore += 8;
  }

  // Note: our chart engine does not compute a Vertex point, so these checks
  // never trigger today; kept for forward compatibility if Vertex is added.
  const vertex1 = chart1.planets.find((p) => p.name === 'Vertex')?.longitude;
  const vertex2 = chart2.planets.find((p) => p.name === 'Vertex')?.longitude;

  if (sun1 && vertex2 && checkConjunction(sun1, vertex2)) {
    indicators.push({
      type: 'karmic',
      name: 'Sun-Vertex Fated Connection',
      description: 'Destined meeting - fated soul connection',
      strength: 96,
      present: true,
      details: 'This meeting was destined. The Vertex represents fated encounters, and your Sun activates their destiny point.',
    });
    soulmateScore += 19;
    twinFlameScore += 17;
  }

  if (sun2 && vertex1 && checkConjunction(sun2, vertex1)) {
    indicators.push({
      type: 'karmic',
      name: 'Their Sun on Your Vertex',
      description: 'They are your fated encounter',
      strength: 96,
      present: true,
      details: 'This relationship was meant to happen. They appeared in your life at exactly the right time for your soul\'s evolution.',
    });
    soulmateScore += 19;
    twinFlameScore += 17;
  }

  if (moon1 && vertex2 && checkConjunction(moon1, vertex2)) {
    indicators.push({
      type: 'karmic',
      name: 'Moon-Vertex Emotional Destiny',
      description: 'Emotionally destined connection',
      strength: 93,
      present: true,
      details: 'Your emotional connection with them is fated. You were meant to experience this profound emotional bond.',
    });
    soulmateScore += 17;
    twinFlameScore += 15;
  }

  if (moon2 && vertex1 && checkConjunction(moon2, vertex1)) {
    indicators.push({
      type: 'karmic',
      name: 'Their Moon on Your Vertex',
      description: 'They fulfill an emotional destiny in your life',
      strength: 93,
      present: true,
      details: 'Meeting them was emotionally fated. They bring the emotional experiences you need for your soul\'s journey.',
    });
    soulmateScore += 17;
    twinFlameScore += 15;
  }

  indicators.sort((a, b) => b.strength - a.strength);

  const isTwinFlame = twinFlameScore >= 40;
  const isSoulmate = soulmateScore >= 35;

  let connectionType: SoulmateAnalysis['connectionType'];
  let summary: string;

  if (isTwinFlame && twinFlameScore >= 60) {
    connectionType = 'Twin Flame';
    summary = `This is a powerful Twin Flame connection. You share ${indicators.length} significant soul connection indicators with a twin flame score of ${twinFlameScore}%. Twin flames are two halves of the same soul, destined to meet for profound spiritual transformation. This relationship will be intensely transformative, bringing both incredible highs and challenging growth periods. You mirror each other's deepest wounds and highest potentials, pushing each other toward spiritual awakening.`;
  } else if (isSoulmate && soulmateScore >= 60) {
    connectionType = 'Soulmate';
    summary = `This is a genuine Soulmate connection. You share ${indicators.length} significant soul connection indicators with a soulmate score of ${soulmateScore}%. Soulmates come into your life to help you grow, evolve, and fulfill your life purpose. This relationship feels familiar, comfortable, and deeply meaningful. You understand each other on a soul level and support each other's highest good.`;
  } else if (isSoulmate && twinFlameScore >= 30) {
    connectionType = 'Karmic Soulmate';
    summary = `This is a Karmic Soulmate connection. You share ${indicators.length} significant indicators with scores of ${soulmateScore}% (soulmate) and ${twinFlameScore}% (twin flame). This relationship has strong karmic ties from past lives. You've come together to complete unfinished business, learn important lessons, and support each other's evolution. The connection feels fated and deeply significant.`;
  } else if (isSoulmate || twinFlameScore >= 25) {
    connectionType = 'Divine Partnership';
    summary = `This is a Divine Partnership. You share ${indicators.length} meaningful soul connection indicators. While not necessarily a twin flame or traditional soulmate, this relationship is spiritually significant and divinely guided. You're meant to share important experiences and help each other grow. The bond is special and purposeful.`;
  } else if (indicators.length >= 3) {
    connectionType = 'Strong Connection';
    summary = `You share a Strong Spiritual Connection with ${indicators.length} soul connection indicators. While you may not be twin flames or soulmates in the traditional sense, there are definite karmic ties and spiritual significance to your relationship. You can learn and grow together meaningfully.`;
  } else {
    connectionType = 'Moderate Connection';
    summary = `This relationship shows a Moderate Connection with ${indicators.length} soul indicators. While there may not be intense twin flame or soulmate dynamics, every relationship has purpose and potential for growth. Focus on building understanding, communication, and shared values.`;
  }

  return {
    isTwinFlame,
    isSoulmate,
    twinFlameScore,
    soulmateScore,
    connectionType,
    indicators,
    summary,
  };
}

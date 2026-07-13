import type { ZodiacSign } from '@pl-cms/shared';

export interface ZodiacInfo {
  element: 'Fire' | 'Earth' | 'Air' | 'Water';
  modality: 'Cardinal' | 'Fixed' | 'Mutable';
  ruler: string;
  keywords: string[];
  description: string;
}

export interface PlanetaryDignity {
  domicile: ZodiacSign[];
  exaltation?: ZodiacSign;
  detriment?: ZodiacSign[];
  fall?: ZodiacSign;
}

export const ZODIAC_INFO: Record<ZodiacSign, ZodiacInfo> = {
  Aries: {
    element: 'Fire',
    modality: 'Cardinal',
    ruler: 'Mars',
    keywords: ['Initiative', 'Courage', 'Leadership', 'Pioneering', 'Independence'],
    description: 'The Ram - First sign of the zodiac, representing new beginnings, assertiveness, and dynamic action. Aries energy is bold, impulsive, and always ready to take the lead.',
  },
  Taurus: {
    element: 'Earth',
    modality: 'Fixed',
    ruler: 'Venus',
    keywords: ['Stability', 'Sensuality', 'Persistence', 'Security', 'Pleasure'],
    description: 'The Bull - Grounded and steadfast, Taurus values material security, sensory experiences, and lasting foundations. Patient yet determined, this sign builds for permanence.',
  },
  Gemini: {
    element: 'Air',
    modality: 'Mutable',
    ruler: 'Mercury',
    keywords: ['Communication', 'Curiosity', 'Versatility', 'Intellect', 'Adaptability'],
    description: 'The Twins - Quick-witted and curious, Gemini thrives on information exchange and mental stimulation. This sign represents duality, connection, and the power of words.',
  },
  Cancer: {
    element: 'Water',
    modality: 'Cardinal',
    ruler: 'Moon',
    keywords: ['Nurturing', 'Emotion', 'Protection', 'Intuition', 'Home'],
    description: 'The Crab - Deeply feeling and protective, Cancer represents emotional depth, family bonds, and the need for security. This sign creates safe spaces and nurtures with devotion.',
  },
  Leo: {
    element: 'Fire',
    modality: 'Fixed',
    ruler: 'Sun',
    keywords: ['Creativity', 'Expression', 'Generosity', 'Confidence', 'Drama'],
    description: 'The Lion - Radiant and expressive, Leo embodies creative self-expression, warmth, and natural authority. This sign shines brightly and inspires others through genuine heart-centered leadership.',
  },
  Virgo: {
    element: 'Earth',
    modality: 'Mutable',
    ruler: 'Mercury',
    keywords: ['Analysis', 'Service', 'Precision', 'Health', 'Improvement'],
    description: 'The Virgin - Detail-oriented and discerning, Virgo seeks perfection through refinement and practical service. This sign excels at analysis, organization, and healing.',
  },
  Libra: {
    element: 'Air',
    modality: 'Cardinal',
    ruler: 'Venus',
    keywords: ['Balance', 'Harmony', 'Partnership', 'Justice', 'Aesthetics'],
    description: 'The Scales - Seeking equilibrium and beauty, Libra represents partnership, diplomacy, and refined taste. This sign strives for fairness and creates harmony through relationship.',
  },
  Scorpio: {
    element: 'Water',
    modality: 'Fixed',
    ruler: 'Pluto',
    keywords: ['Transformation', 'Intensity', 'Power', 'Depth', 'Regeneration'],
    description: 'The Scorpion - Powerful and penetrating, Scorpio delves into hidden depths and embraces transformation. This sign represents psychological insight, passion, and rebirth through crisis.',
  },
  Sagittarius: {
    element: 'Fire',
    modality: 'Mutable',
    ruler: 'Jupiter',
    keywords: ['Expansion', 'Philosophy', 'Adventure', 'Optimism', 'Wisdom'],
    description: 'The Archer - Freedom-loving and philosophical, Sagittarius seeks meaning through exploration and higher learning. This sign represents faith, truth-seeking, and boundless enthusiasm.',
  },
  Capricorn: {
    element: 'Earth',
    modality: 'Cardinal',
    ruler: 'Saturn',
    keywords: ['Ambition', 'Structure', 'Discipline', 'Authority', 'Achievement'],
    description: 'The Goat - Ambitious and responsible, Capricorn builds lasting structures through disciplined effort. This sign represents mastery, tradition, and the achievement of long-term goals.',
  },
  Aquarius: {
    element: 'Air',
    modality: 'Fixed',
    ruler: 'Uranus',
    keywords: ['Innovation', 'Humanity', 'Independence', 'Progress', 'Originality'],
    description: 'The Water Bearer - Visionary and unconventional, Aquarius represents collective consciousness and progressive ideals. This sign champions individuality while working for the greater good.',
  },
  Pisces: {
    element: 'Water',
    modality: 'Mutable',
    ruler: 'Neptune',
    keywords: ['Compassion', 'Imagination', 'Spirituality', 'Empathy', 'Transcendence'],
    description: 'The Fish - Deeply sensitive and boundless, Pisces dissolves boundaries through compassion and creative imagination. This sign represents universal love, mysticism, and artistic inspiration.',
  },
};

export const PLANETARY_DIGNITIES: Record<string, PlanetaryDignity> = {
  Sun: { domicile: ['Leo'], exaltation: 'Aries', detriment: ['Aquarius'], fall: 'Libra' },
  Moon: { domicile: ['Cancer'], exaltation: 'Taurus', detriment: ['Capricorn'], fall: 'Scorpio' },
  Mercury: { domicile: ['Gemini', 'Virgo'], exaltation: 'Virgo', detriment: ['Sagittarius', 'Pisces'], fall: 'Pisces' },
  Venus: { domicile: ['Taurus', 'Libra'], exaltation: 'Pisces', detriment: ['Scorpio', 'Aries'], fall: 'Virgo' },
  Mars: { domicile: ['Aries', 'Scorpio'], exaltation: 'Capricorn', detriment: ['Libra', 'Taurus'], fall: 'Cancer' },
  Jupiter: { domicile: ['Sagittarius', 'Pisces'], exaltation: 'Cancer', detriment: ['Gemini', 'Virgo'], fall: 'Capricorn' },
  Saturn: { domicile: ['Capricorn', 'Aquarius'], exaltation: 'Libra', detriment: ['Cancer', 'Leo'], fall: 'Aries' },
  Uranus: { domicile: ['Aquarius'], exaltation: 'Scorpio', detriment: ['Leo'], fall: 'Taurus' },
  Neptune: { domicile: ['Pisces'], exaltation: 'Cancer', detriment: ['Virgo'], fall: 'Capricorn' },
  Pluto: { domicile: ['Scorpio'], exaltation: 'Aries', detriment: ['Taurus'], fall: 'Libra' },
};

export function getPlanetaryDignity(planetName: string, sign: ZodiacSign): string | null {
  const dignity = PLANETARY_DIGNITIES[planetName];
  if (!dignity) return null;

  if (dignity.domicile.includes(sign)) return 'Domicile';
  if (dignity.exaltation === sign) return 'Exaltation';
  if (dignity.detriment && dignity.detriment.includes(sign)) return 'Detriment';
  if (dignity.fall === sign) return 'Fall';
  return null;
}

export function getDignityDescription(dignityType: string): string {
  const descriptions: Record<string, string> = {
    Domicile: 'At home - Planet functions naturally and powerfully',
    Exaltation: 'Honored guest - Planet expresses its highest qualities',
    Detriment: 'In opposition - Planet faces challenges in expression',
    Fall: 'Weakened - Planet struggles to manifest its nature',
  };
  return descriptions[dignityType] || '';
}

export function getDignityColor(dignityType: string): string {
  const colors: Record<string, string> = {
    Domicile: 'oklch(0.70 0.20 150)',
    Exaltation: 'oklch(0.78 0.15 85)',
    Detriment: 'oklch(0.60 0.22 40)',
    Fall: 'oklch(0.55 0.22 25)',
  };
  return colors[dignityType] || 'oklch(0.70 0.02 270)';
}

export interface HouseInfo {
  name: string;
  category: 'Angular' | 'Succedent' | 'Cadent';
  element: 'Fire' | 'Earth' | 'Air' | 'Water';
  naturalSign: ZodiacSign;
  naturalRuler: string;
  keywords: string[];
  description: string;
  lifeAreas: string[];
  psychologicalTheme: string;
}

export const HOUSE_INFO: Record<number, HouseInfo> = {
  1: {
    name: '1st House - House of Self',
    category: 'Angular',
    element: 'Fire',
    naturalSign: 'Aries',
    naturalRuler: 'Mars',
    keywords: ['Identity', 'Appearance', 'First Impressions', 'Self-Expression', 'Vitality'],
    description: 'The Ascendant and 1st house represent your outward personality, physical body, and how you present yourself to the world. This is the mask you wear and the lens through which you experience life. It governs your natural approach to new situations and your instinctive responses.',
    lifeAreas: ['Physical appearance and body', 'Personality and temperament', 'First impressions', 'Self-awareness', 'Personal initiatives', 'How you begin things'],
    psychologicalTheme: 'The 1st house represents the formation of ego and personal identity. It shows how you assert your existence in the world and the immediate, unfiltered expression of your being.',
  },
  2: {
    name: '2nd House - House of Values',
    category: 'Succedent',
    element: 'Earth',
    naturalSign: 'Taurus',
    naturalRuler: 'Venus',
    keywords: ['Money', 'Possessions', 'Self-Worth', 'Resources', 'Security'],
    description: 'The 2nd house governs your relationship with the material world, including finances, possessions, and personal values. It reveals what you consider valuable and how you build security. This house shows your earning potential and attitudes toward money and resources.',
    lifeAreas: ['Personal finances and income', 'Material possessions', 'Self-worth and self-esteem', 'Personal resources and talents', 'What you value most', 'Financial security'],
    psychologicalTheme: 'The 2nd house reflects your sense of self-worth and the connection between inner value and outer resources. It shows how you sustain yourself and what makes you feel secure and grounded.',
  },
  3: {
    name: '3rd House - House of Communication',
    category: 'Cadent',
    element: 'Air',
    naturalSign: 'Gemini',
    naturalRuler: 'Mercury',
    keywords: ['Communication', 'Learning', 'Siblings', 'Short Trips', 'Intellect'],
    description: 'The 3rd house rules communication, learning, and your immediate environment. It governs siblings, neighbors, short journeys, and early education. This house shows how you process information, express thoughts, and connect with your local community.',
    lifeAreas: ['Communication style and writing', 'Learning and early education', 'Siblings and relatives', 'Short trips and local travel', 'Daily interactions', 'Mental agility'],
    psychologicalTheme: 'The 3rd house represents the development of language and rational thought. It shows how you conceptualize reality and share ideas, forming the bridge between inner experience and outer expression.',
  },
  4: {
    name: '4th House - House of Home',
    category: 'Angular',
    element: 'Water',
    naturalSign: 'Cancer',
    naturalRuler: 'Moon',
    keywords: ['Home', 'Family', 'Roots', 'Privacy', 'Foundation'],
    description: 'The IC and 4th house represent your roots, home, family, and emotional foundation. It governs your private life, ancestry, and what makes you feel safe and nurtured. This is your inner sanctum and deepest sense of belonging.',
    lifeAreas: ['Home and living situation', 'Family and ancestry', 'Emotional foundation', 'Private life', 'Real estate and property', 'End of life matters'],
    psychologicalTheme: 'The 4th house represents the psychological foundation and the unconscious roots of personality. It shows your relationship with nurturing, your inner child, and the emotional security you need to thrive.',
  },
  5: {
    name: '5th House - House of Pleasure',
    category: 'Succedent',
    element: 'Fire',
    naturalSign: 'Leo',
    naturalRuler: 'Sun',
    keywords: ['Creativity', 'Romance', 'Children', 'Play', 'Self-Expression'],
    description: 'The 5th house governs creative self-expression, romance, pleasure, and children. It reveals your capacity for joy, playfulness, and artistic creation. This house shows how you shine, take risks, and share your unique gifts with the world.',
    lifeAreas: ['Creative pursuits and hobbies', 'Romance and dating', 'Children and parenthood', 'Entertainment and leisure', 'Speculation and risk-taking', 'Artistic expression'],
    psychologicalTheme: 'The 5th house represents the flowering of individual consciousness through creative self-expression. It shows how you claim your uniqueness and experience joy through authentic self-revelation.',
  },
  6: {
    name: '6th House - House of Health',
    category: 'Cadent',
    element: 'Earth',
    naturalSign: 'Virgo',
    naturalRuler: 'Mercury',
    keywords: ['Work', 'Health', 'Service', 'Daily Routine', 'Improvement'],
    description: 'The 6th house rules daily work, health, service, and routines. It governs your approach to wellness, employment, and acts of service. This house shows how you maintain your physical body and contribute useful work to the world.',
    lifeAreas: ['Daily work and employment', 'Health and wellness', 'Diet and fitness', 'Service to others', 'Pets and small animals', 'Daily routines and habits'],
    psychologicalTheme: 'The 6th house represents the refinement of self through service and self-improvement. It shows how you perfect your craft, maintain your instrument (body), and integrate yourself into functional social systems.',
  },
  7: {
    name: '7th House - House of Partnership',
    category: 'Angular',
    element: 'Air',
    naturalSign: 'Libra',
    naturalRuler: 'Venus',
    keywords: ['Marriage', 'Partnership', 'Relationships', 'Balance', 'Others'],
    description: 'The Descendant and 7th house represent committed partnerships, marriage, and one-on-one relationships. It reveals what you seek in a partner and how you approach cooperation and commitment. This house shows your relationship patterns and shadow qualities you project onto others.',
    lifeAreas: ['Marriage and committed partnerships', 'Business partnerships', 'Open enemies', 'Contracts and agreements', 'What you seek in others', 'Relationship dynamics'],
    psychologicalTheme: 'The 7th house represents the discovery of self through relationship with the "other." It shows qualities you may not fully own in yourself and what you need to learn through intimate partnership and cooperation.',
  },
  8: {
    name: '8th House - House of Transformation',
    category: 'Succedent',
    element: 'Water',
    naturalSign: 'Scorpio',
    naturalRuler: 'Pluto',
    keywords: ['Transformation', 'Shared Resources', 'Intimacy', 'Death', 'Rebirth'],
    description: 'The 8th house governs deep transformation, shared resources, intimacy, and regeneration. It rules inheritances, taxes, death, and rebirth. This house reveals your capacity for profound change and how you merge with others on psychological, financial, and sexual levels.',
    lifeAreas: ['Joint finances and shared resources', 'Inheritances and taxes', 'Deep intimacy and sexuality', 'Death and rebirth', 'Psychological transformation', 'Occult matters'],
    psychologicalTheme: 'The 8th house represents the death of the separate self through deep merger with another. It shows your shadow, your deepest fears and desires, and your capacity for profound psychological transformation and empowerment.',
  },
  9: {
    name: '9th House - House of Philosophy',
    category: 'Cadent',
    element: 'Fire',
    naturalSign: 'Sagittarius',
    naturalRuler: 'Jupiter',
    keywords: ['Higher Learning', 'Travel', 'Philosophy', 'Beliefs', 'Expansion'],
    description: 'The 9th house rules higher education, long-distance travel, philosophy, and belief systems. It governs your search for meaning, your moral compass, and your relationship with higher truth. This house shows how you expand your horizons and find purpose.',
    lifeAreas: ['Higher education and advanced degrees', 'Long-distance travel', 'Philosophy and religion', 'Publishing and teaching', 'Legal matters', 'Personal beliefs and ethics'],
    psychologicalTheme: 'The 9th house represents the quest for ultimate meaning and truth. It shows how you form your worldview, find faith, and expand consciousness beyond personal limitations into universal understanding.',
  },
  10: {
    name: '10th House - House of Career',
    category: 'Angular',
    element: 'Earth',
    naturalSign: 'Capricorn',
    naturalRuler: 'Saturn',
    keywords: ['Career', 'Reputation', 'Achievement', 'Authority', 'Public Life'],
    description: 'The Midheaven and 10th house represent your career, public reputation, and life direction. It governs your professional achievements, social status, and relationship with authority. This house shows your calling and how you contribute to society.',
    lifeAreas: ['Career and profession', 'Public image and reputation', 'Achievements and honors', 'Authority figures', 'Social status', 'Life direction and calling'],
    psychologicalTheme: 'The 10th house represents the crystallization of individual purpose into concrete achievement. It shows how you claim authority, build lasting structures, and fulfill your dharma in the world.',
  },
  11: {
    name: '11th House - House of Community',
    category: 'Succedent',
    element: 'Air',
    naturalSign: 'Aquarius',
    naturalRuler: 'Uranus',
    keywords: ['Friendship', 'Groups', 'Hopes', 'Ideals', 'Innovation'],
    description: 'The 11th house governs friendships, groups, and collective aspirations. It rules your hopes, dreams, and involvement with organizations and causes. This house shows how you connect with like-minded people and work toward future visions.',
    lifeAreas: ['Friendships and social networks', 'Group activities and organizations', 'Hopes and wishes', 'Humanitarian causes', 'Future goals', 'Technology and innovation'],
    psychologicalTheme: 'The 11th house represents the transcendence of personal ego through collective consciousness. It shows your ideals for humanity, your capacity for true friendship, and how you envision a better future.',
  },
  12: {
    name: '12th House - House of the Unconscious',
    category: 'Cadent',
    element: 'Water',
    naturalSign: 'Pisces',
    naturalRuler: 'Neptune',
    keywords: ['Spirituality', 'Subconscious', 'Isolation', 'Transcendence', 'Hidden'],
    description: 'The 12th house governs the unconscious, spirituality, and hidden matters. It rules solitude, retreat, hospitals, and the dissolution of boundaries. This house shows your relationship with the infinite and what you need to release or transcend.',
    lifeAreas: ['Spirituality and mysticism', 'Unconscious patterns', 'Hidden enemies', 'Institutions and confinement', 'Solitude and retreat', 'Karma and past life'],
    psychologicalTheme: 'The 12th house represents the dissolution of ego and the return to source. It shows your connection to the collective unconscious, your spiritual gifts, and areas where you must surrender and trust in something greater than yourself.',
  },
};

export function getHouseCategoryDescription(category: 'Angular' | 'Succedent' | 'Cadent'): string {
  const descriptions: Record<string, string> = {
    Angular: 'Angular houses (1, 4, 7, 10) are the power points of the chart. They represent action, initiative, and the most dynamic areas of life.',
    Succedent: 'Succedent houses (2, 5, 8, 11) follow angular houses and represent consolidation, stability, and sustaining energy.',
    Cadent: 'Cadent houses (3, 6, 9, 12) represent learning, adaptation, and the distribution of energy. They are mental and mutable in nature.',
  };
  return descriptions[category] || '';
}

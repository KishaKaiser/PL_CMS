import type { ChartData, Planet } from '@pl-cms/shared';

export interface NumerologyDebt {
  debtNumber: string;
  area: string;
  description: string;
  pastLifePattern: string;
  resolution: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface AstrologicalDebt {
  indicator: string;
  placement: string;
  karmicMeaning: string;
  lifeChallenge: string;
  pathToBalance: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ResolutionPath {
  area: string;
  challenge: string;
  actions: string[];
  outcome: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface KarmicDebtResult {
  chartId: string;
  birthName: string;
  totalDebtScore: number;
  numerologyDebts: NumerologyDebt[];
  astrologicalDebts: AstrologicalDebt[];
  resolutionPaths: ResolutionPath[];
  aiGuidance?: string;
  calculatedAt: number;
}

function calculateNameNumber(name: string): number {
  const values: Record<string, number> = {
    A: 1, J: 1, S: 1,
    B: 2, K: 2, T: 2,
    C: 3, L: 3, U: 3,
    D: 4, M: 4, V: 4,
    E: 5, N: 5, W: 5,
    F: 6, O: 6, X: 6,
    G: 7, P: 7, Y: 7,
    H: 8, Q: 8, Z: 8,
    I: 9, R: 9,
  };

  const cleanName = name.toUpperCase().replace(/[^A-Z]/g, '');
  let sum = 0;

  for (const char of cleanName) {
    sum += values[char] || 0;
  }

  return sum;
}

function reduceToSingleDigit(num: number): { finalDigit: number; karmicNumbers: number[] } {
  const karmicNumbers: number[] = [];
  let current = num;

  while (current > 9 && current !== 11 && current !== 22 && current !== 33) {
    if (current === 13 || current === 14 || current === 16 || current === 19) {
      karmicNumbers.push(current);
    }

    const digits = current.toString().split('').map(Number);
    current = digits.reduce((sum, digit) => sum + digit, 0);
  }

  return { finalDigit: current, karmicNumbers };
}

function analyzeKarmicDebtNumbers(karmicNumbers: number[]): NumerologyDebt[] {
  const debts: NumerologyDebt[] = [];

  if (karmicNumbers.includes(13)) {
    debts.push({
      debtNumber: 'Karmic Debt 13',
      area: 'Discipline, Work Ethic & Following Through',
      description: 'The karmic debt 13 represents past life patterns of avoiding hard work, taking shortcuts, and leaving tasks incomplete. In previous incarnations, you manipulated others to carry your responsibilities, abandoned projects when they became difficult, or used charm and excuses to evade real effort. This number combines the transformative power of 13 (1+3=4), demanding you build the solid foundation (4) that you neglected before. You may find yourself facing repeated obstacles that force you to work harder than others, as the universe ensures you develop the discipline you previously avoided.',
      pastLifePattern: 'You lived multiple lives where you chose the path of least resistance, relying on others\' labor while taking credit for their work. You may have been someone who started many ventures but finished none, or who used superficial charm to avoid depth and commitment. You accumulated karmic debt by wasting opportunities for growth, by being unreliable when others depended on you, and by prioritizing immediate comfort over long-term development. Your soul avoided learning patience, persistence, and the satisfaction of earned achievement.',
      resolution: 'Your path to freedom requires developing unwavering discipline and completing everything you begin, no matter how small. Start with daily routines: make your bed, finish meals before starting new activities, complete work projects before their deadlines. When obstacles arise, recognize them as karmic tests - push through rather than around them. Practice the "finish line principle": commit publicly to goals to hold yourself accountable. Transform your relationship with work from burden to meditation. Keep detailed records of completed tasks to track your progress. Apologize and make amends when you\'ve let others down. Most importantly, take pride in honest effort rather than clever shortcuts. Over time, you\'ll notice obstacles decreasing as your karmic debt reduces.',
      severity: 'high',
    });
  }

  if (karmicNumbers.includes(14)) {
    debts.push({
      debtNumber: 'Karmic Debt 14',
      area: 'Freedom, Moderation & Responsible Pleasure',
      description: 'The karmic debt 14 signals past life abuse of personal freedom and the five senses. You lived lifetimes dominated by hedonism, addiction, reckless behavior, and sensory excess that harmed both yourself and innocent others. This may have manifested as substance dependencies, sexual exploitation, gambling, gluttony, or any form of overindulgence that destroyed relationships and opportunities. The number 14 reduces to 5 (1+4=5), the vibration of freedom and change, but karmic 14 teaches that true freedom only comes through self-mastery. You\'ll face constant temptations in this life - alcohol, drugs, food, sex, shopping, technology - and your soul\'s evolution depends on learning healthy boundaries with all pleasurable experiences.',
      pastLifePattern: 'In past incarnations, you may have been a merchant who cheated customers, a person who abandoned families for selfish pursuits, or someone whose addictions caused suffering to dependents. You prioritized instant gratification over long-term wellbeing, believing your freedom was more important than others\' safety. You may have spread diseases, financial ruin, or emotional devastation through your reckless choices. The pattern repeated across multiple lifetimes because you refused to learn moderation, always believing "this time will be different" while making the same destructive choices. Your soul now carries the accumulated pain you caused others and yourself.',
      resolution: 'Healing karmic debt 14 requires radical honesty about your relationship with pleasure and freedom. Begin by identifying your "gateway" indulgences - those seemingly innocent pleasures that lead to excess (one drink becomes five, one episode becomes all night). Establish firm, non-negotiable boundaries: no alcohol on weeknights, technology curfews, budget limits on non-essentials. Practice delayed gratification daily - wait 24 hours before purchases, fast from a favorite food weekly, build "boredom tolerance." When temptation strikes, ask: "Who will this harm?" Remember that others depend on your stability. Join support groups if addictive patterns exist. Replace compulsive behaviors with constructive ones: exercise, creative projects, service work. Document your journey to see progress. Most crucially, redefine freedom not as "doing whatever I want" but as "having the power to choose what serves my highest good." True liberation comes from mastery over impulses, not surrender to them.',
      severity: 'critical',
    });
  }

  if (karmicNumbers.includes(16)) {
    debts.push({
      debtNumber: 'Karmic Debt 16',
      area: 'Ego, Humility & Authentic Relationships',
      description: 'The karmic debt 16 is considered the most challenging, representing a "fall from grace" caused by ego, pride, and misuse of love. In past lives, you built an inflated self-image, possibly achieving positions of power, beauty, or status that you used to dominate, betray, or manipulate others in intimate relationships. This number often manifests as sudden, unexpected losses in this lifetime - the tower card moment where everything built on false foundations crumbles. The 16 reduces to 7 (1+6=7), the spiritual seeker, indicating that loss of external validation forces you to find internal truth and genuine humility. Relationships may repeatedly end dramatically, teaching you that love cannot be controlled or possessed.',
      pastLifePattern: 'You may have been unfaithful to devoted partners, used your attractiveness or position to seduce and abandon others, or destroyed families through selfish choices. Perhaps you were royalty who abused privilege, a religious leader who betrayed vows, or a charismatic figure who left emotional wreckage in your wake. You placed yourself above others, believing rules didn\'t apply to you. You may have publicly humiliated those who loved you, broken sacred bonds for momentary pleasure, or used people as stepping stones to higher status. The common thread: you valued your ego\'s desires over others\' hearts and wellbeing, accumulating immense karmic debt through intimate betrayals.',
      resolution: 'Healing karmic debt 16 requires complete ego dissolution and rebuilding yourself on authentic foundations. Expect this lifetime to humble you through loss - relationships ending, career setbacks, public embarrassments - and understand these are corrections, not punishments. When loss comes, resist blame and victimhood. Instead, ask: "What is my ego attached to that needs releasing?" Practice radical honesty in all relationships, even when it makes you look bad. Apologize sincerely for past wrongs without justification. Develop genuine empathy by volunteering with vulnerable populations. In relationships, practice daily acts of humble service: making coffee, listening without interrupting, acknowledging others\' contributions. Catch yourself when positioning yourself above others and immediately course-correct. Study spiritual traditions emphasizing egolessness: Buddhism, Sufi mysticism, Christian humility. Journal on the difference between healthy self-esteem and ego inflation. Accept that rebuilding trust takes years of consistent integrity. The ultimate lesson: true greatness comes from uplifting others, not standing on their shoulders. When you can celebrate others\' successes more than your own, you\'re healing.',
      severity: 'critical',
    });
  }

  if (karmicNumbers.includes(19)) {
    debts.push({
      debtNumber: 'Karmic Debt 19',
      area: 'Power, Service & Interdependence',
      description: 'The karmic debt 19 stems from past life misuse of power and stubborn refusal to cooperate with or assist others. In previous incarnations, you wielded authority selfishly, ruled as a tyrant, or accumulated resources while ignoring others\' suffering. This number indicates you learned to be completely self-sufficient but forgot that humanity thrives through mutual support and compassion. The 19 reduces to 1 (1+9=10=1), the number of independence and leadership, but karmic 19 teaches that true leaders serve rather than dominate. You may struggle with both asking for help and offering it, feeling that any dependence is weakness. This lifetime forces you to learn that strength includes vulnerability and that power is meant to be shared for the collective good.',
      pastLifePattern: 'You may have been a ruler who hoarded wealth while subjects starved, a business owner who exploited workers, or a warrior who conquered without mercy. Perhaps you were someone who achieved great self-sufficiency - a hermit, a wealthy merchant, an isolated landowner - but turned away those seeking assistance, believing they should "help themselves" as you did. You may have refused to acknowledge your own privileges, claiming all success was purely self-made while ignoring those who supported your rise. You lorded your accomplishments over others, using your power to keep people subordinate rather than empowering them. The pattern: you took from the community but refused to give back, accumulating karmic debt through selfish independence.',
      resolution: 'Healing karmic debt 19 requires learning service, cooperation, and humble interdependence. Begin by acknowledging every person who has helped you reach your current position - write thank you letters to teachers, mentors, family members, and even service workers who make your life possible. Practice asking for help with small things daily, even when you could do it yourself - this builds the humility your soul needs. Volunteer regularly in service roles where you help others without recognition: food banks, tutoring, elder care. When you achieve success, immediately ask "Who can I lift up with this?" and take concrete action. In leadership positions, focus on empowering others rather than maintaining control - delegate, train, celebrate team wins over personal glory. Practice generosity without keeping score: anonymous donations, helping without being asked, giving more than is comfortable. Notice when you feel superior to those needing help and transform that judgment into compassion. Study servant leadership models and interdependence philosophies. Remember: the same creative force flows through all beings. Your power is not "yours" but life expressing through you, meant to be shared freely. When you can receive help gracefully and give it generously, you balance this karmic debt.',
      severity: 'high',
    });
  }

  return debts;
}

// Our chart engine already includes a real 'South Node' point, so prefer that
// over recomputing it here.
function getSouthNode(chart: ChartData): Planet | null {
  const existing = chart.planets.find((p) => p.name === 'South Node');
  if (existing) return existing;

  const northNode = chart.planets.find((p) => p.name === 'True Node' || p.name === 'North Node');
  if (!northNode) return null;

  const southNodeLongitude = (northNode.longitude + 180) % 360;
  const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
  const signIndex = Math.floor(southNodeLongitude / 30);

  let southNodeHouse = 1;
  const houses = chart.houses;
  for (let i = 0; i < houses.length; i += 1) {
    const currentCusp = houses[i].cusp;
    const nextCusp = houses[(i + 1) % houses.length].cusp;

    if (nextCusp > currentCusp) {
      if (southNodeLongitude >= currentCusp && southNodeLongitude < nextCusp) {
        southNodeHouse = i + 1;
        break;
      }
    } else if (southNodeLongitude >= currentCusp || southNodeLongitude < nextCusp) {
      southNodeHouse = i + 1;
      break;
    }
  }

  return {
    name: 'South Node',
    symbol: '☋',
    longitude: southNodeLongitude,
    sign: signs[signIndex],
    degree: southNodeLongitude % 30,
    house: southNodeHouse,
  };
}

function analyzeAstrologicalDebts(chart: ChartData): AstrologicalDebt[] {
  const debts: AstrologicalDebt[] = [];

  const southNode = getSouthNode(chart);
  if (southNode) {
    const severity = [1, 4, 7, 10].includes(southNode.house) ? 'critical' : [2, 5, 8, 11].includes(southNode.house) ? 'high' : 'medium';

    debts.push({
      indicator: `South Node in ${southNode.sign}`,
      placement: `House ${southNode.house}`,
      karmicMeaning: `Your soul's comfort zone from past lives. In ${southNode.sign}, you mastered certain traits but may have overused them or used them inappropriately.`,
      lifeChallenge: getHouseChallenge(southNode.house, southNode.sign),
      pathToBalance: `Move toward your North Node (opposite sign and house) while releasing over-reliance on ${southNode.sign} patterns.`,
      severity,
    });
  }

  const saturn = chart.planets.find((p) => p.name === 'Saturn');
  if (saturn) {
    const severity = [1, 4, 7, 10].includes(saturn.house) ? 'critical' : [8, 12].includes(saturn.house) ? 'high' : 'medium';

    debts.push({
      indicator: `Saturn in ${saturn.sign}`,
      placement: `House ${saturn.house}`,
      karmicMeaning: 'Saturn represents your greatest karmic lessons and responsibilities. This placement shows where you must develop mastery through discipline and patience.',
      lifeChallenge: getSaturnChallenge(saturn.house, saturn.sign),
      pathToBalance: 'Accept Saturn\'s lessons with maturity. Work consistently in this area without resistance. Time and effort will bring mastery and respect.',
      severity,
    });
  }

  const pluto = chart.planets.find((p) => p.name === 'Pluto');
  if (pluto) {
    const severity = [8, 12, 4].includes(pluto.house) ? 'critical' : [1, 7].includes(pluto.house) ? 'high' : 'medium';

    debts.push({
      indicator: `Pluto in ${pluto.sign}`,
      placement: `House ${pluto.house}`,
      karmicMeaning: 'Pluto reveals areas requiring deep transformation and where you\'ve experienced power struggles or trauma across lifetimes.',
      lifeChallenge: getPlutoChallenge(pluto.house, pluto.sign),
      pathToBalance: 'Embrace transformation in this area. Release control and power struggles. Allow death and rebirth cycles to transform you completely.',
      severity,
    });
  }

  const chiron = chart.planets.find((p) => p.name === 'Chiron');
  if (chiron) {
    debts.push({
      indicator: `Chiron (Wounded Healer) in ${chiron.sign}`,
      placement: `House ${chiron.house}`,
      karmicMeaning: 'Chiron represents your deepest wound carried from past lives - and paradoxically, your greatest healing gift to offer others.',
      lifeChallenge: getChironChallenge(chiron.house, chiron.sign),
      pathToBalance: 'Heal yourself first, then use your experience to help others with similar wounds. Your pain becomes your purpose and gift.',
      severity: 'medium',
    });
  }

  return debts.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

function getHouseChallenge(house: number, sign: string): string {
  const challenges: Record<number, string> = {
    1: `Your past life identity in ${sign} may dominate your current life, preventing growth.`,
    2: `You over-relied on ${sign} values and possessions, now must develop new resources.`,
    3: `Communication and learning patterns from ${sign} need updating and refinement.`,
    4: `Family karma and emotional patterns from ${sign} require healing and release.`,
    5: `Creative self-expression in ${sign} was misused; now needs authentic expression.`,
    6: `Service and health patterns from ${sign} were neglected or obsessive.`,
    7: `Relationship patterns from ${sign} were co-dependent or dominating.`,
    8: `Power, intimacy, and transformation in ${sign} involved control or victimhood.`,
    9: `Beliefs and philosophies in ${sign} were dogmatic or caused harm.`,
    10: `Public role and authority in ${sign} was abused or neglected.`,
    11: `Group involvement in ${sign} excluded others or lacked authentic connection.`,
    12: `Spiritual escapism or martyrdom in ${sign} avoided real-world responsibility.`,
  };
  return challenges[house] || `Lessons from ${sign} need integration and balance.`;
}

function getSaturnChallenge(house: number, sign: string): string {
  const challenges: Record<number, string> = {
    1: `Building authentic self-identity and confidence despite ${sign} restrictions.`,
    2: `Developing financial security and self-worth through ${sign} discipline.`,
    3: `Learning to communicate with authority and clarity in ${sign} expression.`,
    4: `Healing family wounds and creating emotional stability through ${sign} maturity.`,
    5: `Expressing creativity and joy despite ${sign} fears of judgment.`,
    6: `Establishing healthy routines and service through ${sign} responsibility.`,
    7: `Committing to relationships with ${sign} boundaries and maturity.`,
    8: `Transforming through loss and intimacy with ${sign} wisdom.`,
    9: `Building philosophy and faith through ${sign} life experience.`,
    10: `Achieving career mastery and public respect through ${sign} persistence.`,
    11: `Creating lasting friendships and social contributions through ${sign} loyalty.`,
    12: `Developing spiritual maturity and releasing isolation through ${sign} wisdom.`,
  };
  return challenges[house] || `Mastering discipline and responsibility in ${sign} qualities.`;
}

function getPlutoChallenge(house: number, sign: string): string {
  const challenges: Record<number, string> = {
    1: `Transforming your entire identity and releasing ${sign} control over self-image.`,
    2: `Undergoing financial and value transformation, releasing ${sign} attachment.`,
    3: `Transforming how you think and communicate, releasing ${sign} mental patterns.`,
    4: `Deep family healing and releasing ${sign} emotional inheritance.`,
    5: `Transforming creative expression and romance, releasing ${sign} ego patterns.`,
    6: `Healing through work and health crises, transforming ${sign} service patterns.`,
    7: `Experiencing relationship death-rebirth cycles, transforming ${sign} relating patterns.`,
    8: `Complete transformation through loss, intimacy, and shared resources in ${sign}.`,
    9: `Philosophical and belief transformation, releasing ${sign} dogma.`,
    10: `Career and reputation transformation, releasing ${sign} public masks.`,
    11: `Friendship and social transformation, releasing ${sign} group identity.`,
    12: `Spiritual transformation through surrender, releasing ${sign} ego structures.`,
  };
  return challenges[house] || `Deep transformation required in ${sign} expression.`;
}

function getChironChallenge(house: number, sign: string): string {
  const challenges: Record<number, string> = {
    1: `Wounded sense of self and identity in ${sign} expression.`,
    2: `Wounded relationship with money, possessions, and ${sign} values.`,
    3: `Wounded communication and learning in ${sign} expression.`,
    4: `Deep family wounds and ${sign} emotional pain from childhood.`,
    5: `Wounded creativity, romance, and ${sign} self-expression.`,
    6: `Health wounds and wounded service in ${sign} work patterns.`,
    7: `Relationship wounds and ${sign} partnership pain.`,
    8: `Wounds around intimacy, loss, and ${sign} transformation.`,
    9: `Wounded beliefs and ${sign} spiritual/philosophical pain.`,
    10: `Career wounds and ${sign} public humiliation or failure.`,
    11: `Friendship wounds and ${sign} social rejection or isolation.`,
    12: `Spiritual wounds and ${sign} connection to the divine.`,
  };
  return challenges[house] || `Deep wounding in ${sign} that becomes healing wisdom.`;
}

function generateResolutionPaths(numerologyDebts: NumerologyDebt[], astrologicalDebts: AstrologicalDebt[]): ResolutionPath[] {
  const paths: ResolutionPath[] = [];

  const highDebts = [...numerologyDebts, ...astrologicalDebts].filter((d) => d.severity === 'critical' || d.severity === 'high');

  highDebts.forEach((debt) => {
    if ('debtNumber' in debt) {
      const numerologyDebt = debt;
      paths.push({
        area: numerologyDebt.area,
        challenge: numerologyDebt.description,
        actions: generateActionsForNumerology(numerologyDebt),
        outcome: `Freedom from ${numerologyDebt.area.toLowerCase()} patterns and soul evolution`,
        priority: numerologyDebt.severity === 'critical' ? 'Critical' : 'High',
      });
    } else {
      const astroDebt = debt;
      paths.push({
        area: astroDebt.indicator,
        challenge: astroDebt.lifeChallenge,
        actions: generateActionsForAstrology(astroDebt),
        outcome: astroDebt.pathToBalance,
        priority: astroDebt.severity === 'critical' ? 'Critical' : 'High',
      });
    }
  });

  if (paths.length === 0) {
    paths.push({
      area: 'General Soul Growth',
      challenge: 'Continue developing spiritual awareness and compassion',
      actions: [
        'Practice daily meditation or contemplation',
        'Help others without expectation of return',
        'Study spiritual wisdom from various traditions',
        'Develop intuition and inner guidance',
      ],
      outcome: 'Continued soul evolution and spiritual awakening',
      priority: 'Medium',
    });
  }

  return paths.slice(0, 5);
}

function generateActionsForNumerology(debt: NumerologyDebt): string[] {
  const actionMap: Record<string, string[]> = {
    'Discipline, Work Ethic & Following Through': [
      'Create a daily "completion log" where you record every task finished, no matter how small - build evidence of your reliability',
      'Use the "two-minute rule": if something takes less than two minutes, do it immediately rather than postponing',
      'When starting new projects, publicly commit to a completion date and accountability partner',
      'Set a timer and work for focused 25-minute sessions (Pomodoro Technique) to build sustained effort muscles',
      'Practice finishing books, meals, conversations, and activities completely before moving to the next',
      'When you encounter obstacles, pause and say "This is my karmic test" - then push through instead of around',
      'Apologize and make amends to anyone you\'ve let down through incompletions or unreliability',
    ],
    'Freedom, Moderation & Responsible Pleasure': [
      'Identify your three biggest temptations and create non-negotiable boundaries (e.g., no alcohol Monday-Thursday, $50 monthly discretionary spending limit)',
      'Practice the 24-hour rule: wait a full day before indulging any impulse purchase, binge activity, or sensory craving',
      'Join a support group (AA, DA, SA, OA, etc.) even if you don\'t think you have an "addiction" - learn from others working on moderation',
      'Replace one compulsive behavior weekly with a constructive alternative: meditation instead of scrolling, exercise instead of drinking, creative work instead of shopping',
      'Before indulging, ask yourself: "Who depends on my stability? How will tomorrow-me feel about today-me\'s choice?"',
      'Build "boredom tolerance" by sitting quietly for 10 minutes daily without phones, food, or entertainment',
      'Keep a consequences journal: record every time overindulgence caused harm (financial, relational, health, time) to build awareness',
    ],
    'Ego, Humility & Authentic Relationships': [
      'Practice the "credit others first" rule: in any success story, name three people who helped before mentioning your contribution',
      'When you catch yourself positioning yourself above others, immediately perform an act of humble service for that person',
      'Apologize sincerely to anyone you\'ve betrayed or hurt, taking full responsibility without justifications or "but you also..." statements',
      'In conversations, track your "I/me" statements versus questions about others - aim for 2:1 ratio of questions to self-references',
      'Volunteer in roles where you serve people you might normally consider "beneath you" - this dissolves ego barriers',
      'When relationships end, ask "What did my ego need that my heart didn\'t?" and journal on the difference',
      'Study and practice Loving-Kindness meditation, specifically directing compassion toward people you feel superior to',
      'Accept compliments with simple "thank you" rather than agreement or false modesty - neither inflating nor deflating',
    ],
    'Power, Service & Interdependence': [
      'Write thank-you letters to 10 people who helped you reach your current position, acknowledging how their support made your success possible',
      'Practice asking for help with small things daily, even when you could easily do it yourself - this builds humility and connection',
      'Volunteer 4-8 hours monthly in direct service roles: food banks, tutoring, elder care, crisis hotlines - serve without recognition',
      'When you achieve success, immediately identify three people you can "bring up with you" and take concrete supportive action',
      'Create a personal giving policy: donate X% of income/time before calculating your own needs - prioritize generosity',
      'Notice when you feel superior to people asking for help; immediately reframe as "the same life force flows through both of us"',
      'In leadership positions, measure success by team members empowered rather than personal accomplishments',
      'Practice receiving help graciously: when someone offers assistance, say "yes, thank you" instead of "I\'ve got it"',
    ],
  };

  return actionMap[debt.area] || [
    'Reflect on this pattern in your life',
    'Seek professional guidance if needed',
    'Practice awareness when the pattern emerges',
    'Make different choices consistently over time',
  ];
}

function generateActionsForAstrology(debt: AstrologicalDebt): string[] {
  if (debt.indicator.includes('South Node')) {
    return [
      'Keep a "pattern journal" noting when you fall back into comfortable South Node behaviors - awareness is the first step to change',
      'Study your North Node sign and house thoroughly - read books, consult astrologers, understand the qualities you\'re here to develop',
      'Set monthly "North Node challenges" - small experiments with the opposite energy (if South Node is in solitary Capricorn, try group creative activities)',
      'Notice what triggers regression: stress, fear, relationships? Develop alternative responses aligned with your North Node',
      'Celebrate progress toward North Node qualities, even tiny steps - this builds momentum for soul growth',
      'Create affirmations embodying North Node energy and speak them daily',
      'Find mentors or role models who embody your North Node qualities - learn by observation and conversation',
    ];
  }
  if (debt.indicator.includes('Saturn')) {
    return [
      'Reframe Saturn\'s challenges as your "mastery curriculum" - this is where you\'re becoming an expert through lived experience',
      'Set long-term goals (5-10 years) in this house/sign area - Saturn rewards patience and consistent effort over time',
      'When restrictions appear, ask "What is this teaching me?" rather than "Why is this happening to me?"',
      'Study the work of masters in this area - if Saturn is in your career house, study biographies of people who achieved lasting success',
      'Build slowly and thoroughly: if Saturn is in your financial house, create detailed budgets and investment plans; in relationships, move at a measured pace',
      'Track your progress annually - Saturn works incrementally, and you need to see how far you\'ve come to stay motivated',
      'Seek mentorship from someone older or more experienced in this Saturn area - you\'re meant to learn from tradition and wisdom',
    ];
  }
  if (debt.indicator.includes('Pluto')) {
    return [
      'Accept that transformation in this area is non-negotiable - resistance creates suffering, surrender creates metamorphosis',
      'Work with a therapist, counselor, or depth psychologist to explore your shadow aspects safely',
      'Practice "ego death" exercises: meditation on impermanence, contemplating "Who am I without [this identity/possession/relationship]?"',
      'When crisis or loss occurs in this area, trust it\'s clearing space for something more authentic - don\'t rush to fill the void',
      'Study psychology, especially shadow work and transformation processes - understanding Pluto intellectually helps you navigate it emotionally',
      'Release attachments consciously before they\'re ripped away: regularly give away possessions, practice non-attachment meditations',
      'Embrace endings as sacred: create rituals for closure, honor what was while releasing what no longer serves',
    ];
  }
  if (debt.indicator.includes('Chiron')) {
    return [
      'Acknowledge your wound openly and without shame - write about it, talk about it with trusted others, honor that this pain is real',
      'Pursue professional healing: therapy, somatic work, energy healing, or whatever modality resonates with your wound type',
      'When healed enough, volunteer or work in areas related to your wound - help others struggling with similar pain',
      'Study the archetype of the "wounded healer" - understand that your greatest pain becomes your greatest gift',
      'Create art, writing, or other expressions from your wound - transformation happens when we give voice to our pain',
      'Join support groups where others share your type of wound - mutual healing is powerful and reminds you you\'re not alone',
      'Develop compassion practices specifically for the part of you that carries this wound - self-compassion accelerates healing',
    ];
  }
  return [
    'Study this placement deeply through books, astrology consultations, and online resources - understanding creates mastery',
    'Journal weekly on how this placement manifests in your current life circumstances',
    'Work with a professional astrologer for personalized guidance on integrating this karmic indicator',
    'Connect with others who share this placement to compare experiences and coping strategies',
    'Be patient with karmic timing - soul lessons unfold across years and decades, not days and weeks',
    'Notice patterns across your life related to this placement - karmic themes repeat until learned',
    'Practice self-compassion - you\'re working on soul-level growth that transcends this single lifetime',
  ];
}

function calculateTotalScore(numerologyDebts: NumerologyDebt[], astrologicalDebts: AstrologicalDebt[]): number {
  const severityPoints = { critical: 25, high: 15, medium: 8, low: 3 };

  const numScore = numerologyDebts.reduce((sum, debt) => sum + severityPoints[debt.severity], 0);
  const astroScore = astrologicalDebts.reduce((sum, debt) => sum + severityPoints[debt.severity], 0);

  return Math.min(100, numScore + astroScore);
}

// `generate` is an injected AI text function (backed by PL_CMS's OllamaClient
// at the call site) so this lib stays framework-agnostic and testable without
// a live LLM.
export async function calculateKarmicDebt(
  chart: ChartData,
  birthName: string,
  generate: (prompt: string) => Promise<string | null>,
): Promise<KarmicDebtResult> {
  const nameNumber = calculateNameNumber(birthName);
  const { finalDigit, karmicNumbers } = reduceToSingleDigit(nameNumber);

  const numerologyDebts = analyzeKarmicDebtNumbers(karmicNumbers);
  const astrologicalDebts = analyzeAstrologicalDebts(chart);
  const resolutionPaths = generateResolutionPaths(numerologyDebts, astrologicalDebts);
  const totalDebtScore = calculateTotalScore(numerologyDebts, astrologicalDebts);

  let aiGuidance: string | undefined;

  try {
    const debtSummary = [
      `Name: ${birthName}`,
      `Life Path considerations: ${finalDigit}`,
      `Karmic Debt Numbers: ${karmicNumbers.join(', ') || 'None'}`,
      `Numerology Debts: ${numerologyDebts.map((d) => d.area).join(', ') || 'None'}`,
      `Key Astrological Indicators: ${astrologicalDebts.slice(0, 3).map((d) => d.indicator).join(', ')}`,
      `Total Karmic Score: ${totalDebtScore}/100`,
    ].join('\n');

    const promptText = `You are a wise karmic counselor combining numerology and astrology. Based on this karmic debt analysis, provide compassionate spiritual guidance (3-4 paragraphs):

${debtSummary}

Focus on:
1. The soul's journey and purpose behind these karmic debts
2. How these challenges are opportunities for spiritual growth
3. Encouragement and practical wisdom for the healing journey
4. The gifts that will emerge from resolving these debts

Write in a warm, encouraging tone. This person is brave for seeking karmic awareness.`;

    aiGuidance = (await generate(promptText)) ?? undefined;
  } catch {
    // AI guidance is optional; the numerology/astrology analysis above stands on its own.
  }

  return {
    chartId: chart.id,
    birthName,
    totalDebtScore,
    numerologyDebts,
    astrologicalDebts,
    resolutionPaths,
    aiGuidance,
    calculatedAt: Date.now(),
  };
}

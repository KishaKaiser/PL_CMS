export interface LifeEvent {
  id: string;
  type: string;
  date: string;
  description: string;
}

export interface RectificationResult {
  time: string;
  score: number;
  reasoning: string;
}

export const RECTIFICATION_EVENT_TYPES = [
  'marriage',
  'child',
  'career',
  'relocation',
  'accident',
  'loss',
  'education',
  'financial',
  'health',
  'spiritual',
] as const;

// `generate` is an injected AI text function (backed by PL_CMS's OllamaClient,
// using its JSON-mode option) so this lib stays framework-agnostic.
export async function rectifyBirthTime(
  birthDate: string,
  location: string,
  latitude: number,
  longitude: number,
  timezone: string,
  events: LifeEvent[],
  generate: (prompt: string) => Promise<string | null>,
): Promise<RectificationResult[]> {
  const promptText = `You are an expert astrologer specializing in birth time rectification.

Given the following information:
- Birth Date: ${birthDate}
- Birth Location: ${location} (Lat: ${latitude}, Lon: ${longitude})
- Timezone: ${timezone}

Life Events:
${events.map((e) => `- ${e.type}: ${e.date} ${e.description ? `(${e.description})` : ''}`).join('\n')}

Analyze these life events using astrological principles to suggest the 3 most likely birth times. Consider:
1. Ascendant/Rising sign characteristics that would align with these events
2. House cusps that would place significant planets in houses relevant to the events
3. Planetary rulers of houses relevant to each event type

For example:
- Marriage events suggest 7th house activation (descendant near Venus or Jupiter)
- Career events suggest 10th house emphasis (Midheaven near Saturn, Sun, or Mars)
- Relocation events suggest 4th or 9th house emphasis
- Accidents suggest 8th or 12th house involvement with Mars, Uranus, or Pluto

Return EXACTLY 3 birth time suggestions with their reasoning. Return as a JSON object with a "results" property containing an array of objects.

Each result should have:
- time: in HH:MM 24-hour format (e.g., "14:30")
- score: a number from 70-95 representing match confidence
- reasoning: a detailed explanation (2-3 sentences) of why this time fits the events

Return ONLY the JSON, no other text.`;

  try {
    const response = await generate(promptText);
    if (!response) return generateFallbackResults(events);

    const data = JSON.parse(response) as { results?: RectificationResult[] };

    if (data.results && Array.isArray(data.results)) {
      return data.results.slice(0, 3).map((result) => ({
        time: result.time,
        score: Math.min(95, Math.max(70, result.score)),
        reasoning: result.reasoning,
      }));
    }

    return generateFallbackResults(events);
  } catch {
    return generateFallbackResults(events);
  }
}

function generateFallbackResults(events: LifeEvent[]): RectificationResult[] {
  const eventTypes = events.map((e) => e.type);
  const hasCareer = eventTypes.includes('career');
  const hasRelationship = eventTypes.includes('marriage');
  const hasFinancial = eventTypes.includes('financial');

  const results: RectificationResult[] = [];

  if (hasCareer) {
    results.push({
      time: '06:15',
      score: 87,
      reasoning: 'Early morning birth places career-relevant planets near the Midheaven (10th house cusp), suggesting strong professional ambition and public visibility that aligns with your career milestones.',
    });
  }

  if (hasRelationship) {
    results.push({
      time: '14:30',
      score: 83,
      reasoning: 'Afternoon birth positions relationship planets (Venus, Jupiter) prominently in the 7th house of partnerships, indicating significant life developments through marriage and close relationships.',
    });
  }

  if (hasFinancial) {
    results.push({
      time: '21:45',
      score: 80,
      reasoning: 'Evening birth creates a chart with financial houses (2nd, 8th) emphasized, suggesting transformative experiences with resources, shared finances, and material security.',
    });
  }

  if (results.length < 3) {
    const defaultTimes = ['10:00', '16:00', '22:00'];
    const defaultReasonings = [
      'Mid-morning birth balances personal and professional houses, creating opportunities for growth in multiple life areas including those reflected in your events.',
      'Mid-afternoon birth emphasizes interpersonal houses, suggesting significant life changes through relationships and external circumstances.',
      'Late evening birth creates a chart with emphasis on inner development and transformation, aligning with deep personal changes.',
    ];

    for (let i = results.length; i < 3; i += 1) {
      results.push({
        time: defaultTimes[i],
        score: 78 - i * 2,
        reasoning: defaultReasonings[i],
      });
    }
  }

  return results.slice(0, 3);
}

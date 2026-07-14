import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { OllamaClient } from './ollama-client';
import { getOllamaSettings } from './ollama-settings.util';

export const TRANSIT_TYPES = [
  { value: 'mercury-retrograde', label: 'Mercury Retrograde', description: 'Communication, technology, and travel disruptions' },
  { value: 'venus-retrograde', label: 'Venus Retrograde', description: 'Love, relationships, and values review' },
  { value: 'mars-retrograde', label: 'Mars Retrograde', description: 'Energy, motivation, and action reassessment' },
  { value: 'jupiter-transit', label: 'Jupiter Transit', description: 'Growth, expansion, and opportunities' },
  { value: 'saturn-transit', label: 'Saturn Transit', description: 'Responsibility, structure, and life lessons' },
  { value: 'uranus-transit', label: 'Uranus Transit', description: 'Change, innovation, and breakthroughs' },
  { value: 'neptune-transit', label: 'Neptune Transit', description: 'Dreams, spirituality, and illusions' },
  { value: 'pluto-transit', label: 'Pluto Transit', description: 'Transformation, power, and deep change' },
  { value: 'solar-eclipse', label: 'Solar Eclipse', description: 'New beginnings and powerful initiations' },
  { value: 'lunar-eclipse', label: 'Lunar Eclipse', description: 'Endings, revelations, and emotional releases' },
  { value: 'new-moon', label: 'New Moon', description: 'Fresh starts and setting intentions' },
  { value: 'full-moon', label: 'Full Moon', description: 'Culmination, completion, and illumination' },
] as const;

export interface GeneratedBlogPost {
  title: string;
  content: string;
}

@Injectable()
export class AstrologyBlogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ollama: OllamaClient,
  ) {}

  async generateBlogPost(transitType: string, additionalContext?: string): Promise<GeneratedBlogPost> {
    const transitInfo = TRANSIT_TYPES.find((t) => t.value === transitType);
    const label = transitInfo?.label || transitType;
    const description = transitInfo?.description || 'astrological transit';

    const prompt = `You are an expert astrologer writing an engaging blog post for a general audience interested in astrology.

Write a comprehensive blog post about ${label}.

Context: ${description}
${additionalContext ? `Additional focus areas: ${additionalContext}` : ''}

The blog post should include:
1. An engaging introduction explaining what ${label} is
2. Key effects and themes people might experience
3. What to expect during this transit
4. Practical advice and tips for navigating this period
5. Do's and don'ts during this transit
6. A positive, empowering conclusion

Write in an accessible, warm tone that balances astrological knowledge with practical wisdom.

IMPORTANT: Keep the content concise (around 500-800 words total) to ensure complete generation.

Return ONLY a valid JSON object with this EXACT structure (no additional text before or after):
{
  "title": "An engaging, SEO-friendly blog post title (one line)",
  "content": "The complete blog post content. Write 4-6 paragraphs. Separate paragraphs with TWO newline characters. Keep total length under 800 words."
}

Ensure all quotes and special characters in the JSON are properly escaped. Do not include any text outside the JSON object.`;

    const settings = await getOllamaSettings(this.prisma, this.config);
    const response = await this.ollama.generate(
      prompt,
      { baseUrl: settings.ollamaBaseUrl, model: settings.ollamaModel },
      { json: true },
    );

    if (!response) {
      throw new Error('The blog post could not be generated. Check the Ollama URL and model settings, then try again.');
    }

    const parsed = parseBlogResponse(response);
    if (!parsed.title || !parsed.content || parsed.content.length < 100) {
      throw new Error('The generated blog post was incomplete. Try generating it again.');
    }

    return parsed;
  }
}

function parseBlogResponse(response: string): GeneratedBlogPost {
  try {
    return JSON.parse(response) as GeneratedBlogPost;
  } catch {
    const match = response.match(/\{[\s\S]*"title"[\s\S]*"content"[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as GeneratedBlogPost;
    }
    throw new Error('Could not parse the blog post response. The response may be incomplete or incorrectly formatted.');
  }
}

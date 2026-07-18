import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { ZODIAC_SIGNS, type ZodiacSign } from '@pl-cms/shared';
import { PrismaService } from '../prisma/prisma.service';
import { OllamaClient } from './ollama-client';
import { getOllamaSettings } from './ollama-settings.util';

export interface GeneratedHoroscope {
  overview: string;
  career: string;
  money: string;
  love: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

@Injectable()
export class HoroscopeService {
  private readonly logger = new Logger(HoroscopeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ollama: OllamaClient,
  ) {}

  /** Fires on the 1st of each month — generates all 12 signs for the new month. */
  @Cron('0 5 1 * *')
  async handleMonthlyGeneration() {
    const now = new Date();
    this.logger.log(`Running scheduled monthly horoscope generation for ${now.getFullYear()}-${now.getMonth() + 1}`);
    await this.generateAllSigns(now.getFullYear(), now.getMonth() + 1);
  }

  async generateForSign(sign: ZodiacSign, year: number, month: number) {
    const prompt = buildHoroscopePrompt(sign, year, month);
    const settings = await getOllamaSettings(this.prisma, this.config);
    const response = await this.ollama.generate(prompt, { baseUrl: settings.ollamaBaseUrl, model: settings.ollamaModel });

    if (!response) {
      throw new BadRequestException('The horoscope could not be generated. Check the Ollama URL and model settings, then try again.');
    }

    let parsed: GeneratedHoroscope;
    try {
      parsed = parseHoroscopeResponse(response);
    } catch (error) {
      this.logger.warn(`Bad horoscope response for ${sign} (${response.length} chars): ${response.slice(0, 2000)}`);
      throw error;
    }

    return this.prisma.horoscope.upsert({
      where: { sign_year_month: { sign, year, month } },
      create: { sign, year, month, ...parsed },
      update: { ...parsed, generatedAt: new Date() },
    });
  }

  /** Generates all 12 signs sequentially; one sign failing doesn't stop the rest. */
  async generateAllSigns(year: number, month: number) {
    const results: { sign: ZodiacSign; ok: boolean; error?: string }[] = [];
    for (const sign of ZODIAC_SIGNS) {
      try {
        await this.generateForSign(sign, year, month);
        results.push({ sign, ok: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(`Horoscope generation failed for ${sign} (${year}-${month}): ${message}`);
        results.push({ sign, ok: false, error: message });
      }
    }
    return results;
  }

  async listForMonth(year: number, month: number) {
    const rows = await this.prisma.horoscope.findMany({ where: { year, month } });
    const bySign = new Map(rows.map((row) => [row.sign, row]));
    return ZODIAC_SIGNS.map((sign) => bySign.get(sign) ?? null);
  }

  async updateSection(id: string, data: { overview?: string; career?: string; money?: string; love?: string }) {
    return this.prisma.horoscope.update({ where: { id }, data });
  }
}

function buildHoroscopePrompt(sign: ZodiacSign, year: number, month: number) {
  const monthName = MONTH_NAMES[month - 1] ?? 'this month';
  return `You are an expert astrologer writing a monthly horoscope for ${sign} for ${monthName} ${year}.

Write a warm, insightful monthly horoscope with four parts:
1. A general overview of the month's energy and themes for ${sign} (2-3 sentences).
2. Career & money guidance for the month (2-3 sentences, work and finances).
3. Love & relationships guidance for the month (2-3 sentences).

Keep each section concise and practical, written directly to the reader ("you").

Respond in EXACTLY this format, with no other text before or after:

OVERVIEW: <the general monthly overview>
CAREER: <career and money guidance>
MONEY: <financial guidance, distinct from the career text>
LOVE: <love and relationships guidance>`;
}

function parseHoroscopeResponse(response: string): GeneratedHoroscope {
  const parsed: GeneratedHoroscope = {
    overview: extractField(response, 'OVERVIEW', 'CAREER'),
    career: extractField(response, 'CAREER', 'MONEY'),
    money: extractField(response, 'MONEY', 'LOVE'),
    love: extractField(response, 'LOVE', null),
  };

  if (!parsed.overview || !parsed.career || !parsed.money || !parsed.love) {
    throw new BadRequestException('The generated horoscope was incomplete. Try generating it again.');
  }
  return parsed;
}

function extractField(response: string, label: string, nextLabel: string | null): string {
  const pattern = nextLabel
    ? new RegExp(`${label}:\\s*([\\s\\S]*?)\\s*${nextLabel}:`, 'i')
    : new RegExp(`${label}:\\s*([\\s\\S]*)`, 'i');
  return response.match(pattern)?.[1]?.trim() ?? '';
}

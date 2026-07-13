import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

const ASTROLOGY_REPORT_SETTINGS_KEY = 'astrology_report_settings';

export interface AstrologyGenerationSettings {
  ollamaBaseUrl?: string;
  ollamaModel?: string;
}

export async function getOllamaSettings(prisma: PrismaService, config: ConfigService): Promise<AstrologyGenerationSettings> {
  const saved = await prisma.setting.findUnique({ where: { key: ASTROLOGY_REPORT_SETTINGS_KEY } });
  const parsed = parseJson<AstrologyGenerationSettings>(saved?.value);
  return {
    ollamaBaseUrl: parsed?.ollamaBaseUrl?.trim() || config.get<string>('OLLAMA_BASE_URL') || 'http://localhost:11434',
    ollamaModel: parsed?.ollamaModel?.trim() || config.get<string>('OLLAMA_MODEL') || '',
  };
}

function parseJson<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

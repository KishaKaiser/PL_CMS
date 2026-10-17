import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { COMPUTER_VOICE_ONLY_NOTE, PROMPT_DEFINITIONS, PROMPT_KEYS, PromptKey } from './phone-prompts';

export const MAX_PROMPT_AUDIO_BYTES = 5 * 1024 * 1024;
const MIN_PROMPT_AUDIO_BYTES = 512;

/** How long a looked-up recording is remembered, so a busy line does not hit the database on every prompt. */
const CACHE_MS = 30_000;

export type AudioFormat = 'mp3' | 'wav';

interface CachedEntry {
  value: { fileToken: string; format: AudioFormat } | null;
  at: number;
}

@Injectable()
export class PhonePromptService {
  private readonly logger = new Logger(PhonePromptService.name);
  private readonly cache = new Map<string, CachedEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** The public address Telnyx uses to fetch recordings (this server as the internet sees it), or null if not set. */
  get publicBaseUrl(): string | null {
    const configured = this.config.get<string>('TELNYX_AUDIO_BASE_URL')?.trim().replace(/\/+$/, '');
    return configured || null;
  }

  /** The URL Telnyx should play for this line, or null to use the computer voice. */
  async audioUrl(key: PromptKey): Promise<string | null> {
    const base = this.publicBaseUrl;
    if (!base) return null;

    const entry = await this.lookup(key);
    return entry ? `${base}/api/phone-audio/${entry.fileToken}.${entry.format}` : null;
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  async list() {
    const recordings = await this.prisma.phonePromptAudio.findMany({
      select: { key: true, fileToken: true, format: true, fileName: true, sizeBytes: true, updatedAt: true },
    });
    const byKey = new Map(recordings.map((recording) => [recording.key, recording]));

    return {
      // Telnyx cannot play recordings until it knows this server's public address.
      audioAddressConfigured: this.publicBaseUrl !== null,
      note: COMPUTER_VOICE_ONLY_NOTE,
      prompts: PROMPT_DEFINITIONS.map((definition) => {
        const recording = byKey.get(definition.key);
        return {
          ...definition,
          recording: recording
            ? {
                fileName: recording.fileName,
                format: recording.format,
                sizeBytes: recording.sizeBytes,
                updatedAt: recording.updatedAt,
                url: `/api/proxy/phone-audio/${recording.fileToken}.${recording.format}`,
              }
            : null,
        };
      }),
    };
  }

  async save(key: string, file: { buffer: Buffer; originalname: string } | undefined) {
    if (!PROMPT_KEYS.has(key)) throw new BadRequestException('Unknown phone line.');
    if (!file) throw new BadRequestException('Choose an MP3 or WAV file to upload.');
    if (file.buffer.length < MIN_PROMPT_AUDIO_BYTES) throw new BadRequestException('That file is too small to be a recording.');
    if (file.buffer.length > MAX_PROMPT_AUDIO_BYTES) throw new BadRequestException('Recordings can be at most 5 MB.');

    const format = detectAudioFormat(file.buffer);
    if (!format) throw new BadRequestException('Upload an MP3 or WAV audio file.');

    // A new token on every upload gives the recording a new address, so Telnyx never plays a stale copy it cached.
    const fileToken = randomUUID();
    const data = {
      fileToken,
      format,
      fileName: file.originalname.slice(0, 200),
      sizeBytes: file.buffer.length,
      data: file.buffer,
    };
    await this.prisma.phonePromptAudio.upsert({ where: { key }, create: { key, ...data }, update: data });
    this.cache.delete(key);

    return { key, format, sizeBytes: file.buffer.length };
  }

  async remove(key: string) {
    if (!PROMPT_KEYS.has(key)) throw new BadRequestException('Unknown phone line.');
    await this.prisma.phonePromptAudio.deleteMany({ where: { key } });
    this.cache.delete(key);
  }

  /** The audio for a public recording address, or null. Anyone with the address can play it, so it is only audio. */
  async getFile(token: string): Promise<{ data: Buffer; format: AudioFormat } | null> {
    const recording = await this.prisma.phonePromptAudio.findUnique({
      where: { fileToken: token },
      select: { data: true, format: true },
    });
    if (!recording) return null;
    return { data: Buffer.from(recording.data), format: recording.format === 'wav' ? 'wav' : 'mp3' };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async lookup(key: PromptKey): Promise<CachedEntry['value']> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;

    try {
      const row = await this.prisma.phonePromptAudio.findUnique({
        where: { key },
        select: { fileToken: true, format: true },
      });
      const value = row ? { fileToken: row.fileToken, format: (row.format === 'wav' ? 'wav' : 'mp3') as AudioFormat } : null;
      this.cache.set(key, { value, at: Date.now() });
      return value;
    } catch (error) {
      // A database hiccup should never silence a call: fall back to the computer voice.
      this.logger.error(`Could not look up the recording for ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }
}

/** MP3 (ID3 tag or an MPEG frame header) or WAV (RIFF/WAVE), judged by the file's own bytes rather than its name. */
export function detectAudioFormat(buffer: Buffer): AudioFormat | null {
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE') return 'wav';
  if (buffer.length >= 3 && buffer.toString('ascii', 0, 3) === 'ID3') return 'mp3';
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return 'mp3';
  return null;
}

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Resolver } from 'dns/promises';
import { PrismaService } from '../prisma/prisma.service';
import { COMPUTER_VOICE_ONLY_NOTE, PROMPT_DEFINITIONS, PROMPT_KEYS, PromptKey } from './phone-prompts';

export const MAX_PROMPT_AUDIO_BYTES = 5 * 1024 * 1024;

/** The computer voice used when nothing else is chosen (Telnyx format <Provider>.<Model>.<Voice>). */
export const DEFAULT_TTS_VOICE = 'AWS.Polly.Joanna';
const VOICE_SETTING_KEY = 'phone_voice';

/** How long a voice Telnyx refused is left alone before it is tried again. */
const REJECTED_VOICE_MS = 10 * 60_000;
const VOICE_CACHE_MS = 30_000;

export type VoiceSource = 'admin' | 'environment' | 'default';
const MIN_PROMPT_AUDIO_BYTES = 512;

/** How long a looked-up recording is remembered, so a busy line does not hit the database on every prompt. */
const CACHE_MS = 30_000;

/** How long the result of checking the public address is remembered. */
const ADDRESS_CHECK_MS = 5 * 60_000;

export type AudioFormat = 'mp3' | 'wav';

interface CachedEntry {
  value: { fileToken: string; format: AudioFormat } | null;
  at: number;
}

@Injectable()
export class PhonePromptService {
  private readonly logger = new Logger(PhonePromptService.name);
  private readonly cache = new Map<string, CachedEntry>();
  private addressCheck: { base: string; at: number; problem: string | null } | null = null;
  private voiceCache: { voice: string | null; at: number } | null = null;
  private readonly rejectedVoices = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * The public address Telnyx uses to fetch recordings (this server as the internet sees it), or null if not set.
   * Only the web address itself is used: if the setting also holds a path (the webhook address pasted in whole, say),
   * the path is ignored.
   */
  get publicBaseUrl(): string | null {
    const configured = this.config.get<string>('TELNYX_AUDIO_BASE_URL')?.trim();
    if (!configured) return null;
    try {
      const url = new URL(configured);
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.origin;
    } catch {
      // not a web address: the address check below explains what is wrong
    }
    return configured.replace(/\/+$/, '');
  }

  /** A note for the admin when the setting holds more than the web address, which is ignored. */
  get addressNote(): string | null {
    const configured = this.config.get<string>('TELNYX_AUDIO_BASE_URL')?.trim();
    if (!configured) return null;
    try {
      const url = new URL(configured);
      if ((url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) {
        return `TELNYX_AUDIO_BASE_URL also contains "${url.pathname}". Only ${url.origin} is used, so recordings are fetched from ${url.origin}/api/phone-audio/…`;
      }
    } catch {
      // handled by the address check
    }
    return null;
  }

  /** The URL Telnyx should play for this line, or null to use the computer voice. */
  async audioUrl(key: PromptKey): Promise<string | null> {
    const base = this.publicBaseUrl;
    if (!base) return null;

    // Telnyx cannot fetch a recording from an address that is not on the public internet, and a call would then
    // go silent. Use the computer voice instead until the address is fixed.
    if (await this.addressProblem()) return null;

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
      addressProblem: await this.addressProblem(),
      addressNote: this.addressNote,
      voice: await this.voiceInfo(),
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

  // ── The computer voice ─────────────────────────────────────────────────────

  /**
   * The voice that reads every line without a recording. A voice chosen in Admin wins, then TELNYX_TTS_VOICE, then
   * the default. A voice Telnyx recently refused is skipped so calls are never left without sound.
   */
  async voice(): Promise<string> {
    const { voice } = await this.voiceInfo();
    return voice;
  }

  async voiceInfo(): Promise<{ voice: string; source: VoiceSource; chosen: string | null; fellBack: boolean }> {
    const admin = await this.adminVoice();
    const environment = this.config.get<string>('TELNYX_TTS_VOICE')?.trim() || null;
    const chosen = admin ?? environment;
    const source: VoiceSource = admin ? 'admin' : environment ? 'environment' : 'default';

    if (chosen && chosen !== DEFAULT_TTS_VOICE && this.isRejected(chosen)) {
      return { voice: DEFAULT_TTS_VOICE, source: 'default', chosen, fellBack: true };
    }
    return { voice: chosen ?? DEFAULT_TTS_VOICE, source, chosen, fellBack: false };
  }

  /** Telnyx refused this voice (a wrong ID, say): use the default for a while instead of failing every prompt. */
  markVoiceRejected(voice: string) {
    this.rejectedVoices.set(voice, Date.now());
    this.logger.error(`Telnyx rejected the computer voice "${voice}". Using ${DEFAULT_TTS_VOICE} until it is fixed.`);
  }

  async setVoice(input: string | null | undefined) {
    const voice = input?.trim() || null;
    if (voice && !/^[A-Za-z0-9][A-Za-z0-9._:\- ]{2,199}$/.test(voice)) {
      throw new BadRequestException('A voice looks like Telnyx.Qwen3TTS.33226e69-3abd-429b-b64a-86775c9b5850 or AWS.Polly.Joanna-Neural.');
    }
    if (voice) {
      await this.prisma.setting.upsert({
        where: { key: VOICE_SETTING_KEY },
        create: { key: VOICE_SETTING_KEY, value: JSON.stringify({ voice }) },
        update: { value: JSON.stringify({ voice }) },
      });
    } else {
      await this.prisma.setting.deleteMany({ where: { key: VOICE_SETTING_KEY } });
    }
    this.voiceCache = null;
    if (voice) this.rejectedVoices.delete(voice);
    return this.voiceInfo();
  }

  private isRejected(voice: string): boolean {
    const at = this.rejectedVoices.get(voice);
    if (at === undefined) return false;
    if (Date.now() - at < REJECTED_VOICE_MS) return true;
    this.rejectedVoices.delete(voice);
    return false;
  }

  private async adminVoice(): Promise<string | null> {
    if (this.voiceCache && Date.now() - this.voiceCache.at < VOICE_CACHE_MS) return this.voiceCache.voice;
    try {
      const setting = await this.prisma.setting.findUnique({ where: { key: VOICE_SETTING_KEY } });
      const parsed = setting ? (JSON.parse(setting.value) as { voice?: unknown }) : null;
      const voice = typeof parsed?.voice === 'string' && parsed.voice.trim() ? parsed.voice.trim() : null;
      this.voiceCache = { voice, at: Date.now() };
      return voice;
    } catch (error) {
      this.logger.error(`Could not read the computer voice setting: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Why Telnyx would not be able to fetch recordings from the configured address, or null if it looks fine. The
   * address has to be a web address whose name exists on the public internet (a name that only your own network knows
   * will not do), so it is looked up with public DNS servers rather than this server's own.
   */
  async addressProblem(): Promise<string | null> {
    const base = this.publicBaseUrl;
    if (!base) return null;

    if (this.addressCheck && this.addressCheck.base === base && Date.now() - this.addressCheck.at < ADDRESS_CHECK_MS) {
      return this.addressCheck.problem;
    }

    const problem = await this.checkAddress(base);
    this.addressCheck = { base, at: Date.now(), problem };
    if (problem) this.logger.warn(`Recordings will not be used: ${problem}`);
    return problem;
  }

  private async checkAddress(base: string): Promise<string | null> {
    let url: URL;
    try {
      url = new URL(base);
    } catch {
      return 'TELNYX_AUDIO_BASE_URL is not a valid web address. It should look like https://your-tunnel.ngrok-free.dev';
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return 'TELNYX_AUDIO_BASE_URL must start with https://';
    }

    const host = url.hostname.toLowerCase();
    const isAddress = /^[0-9.]+$/.test(host) || host.includes(':');
    if (isAddress || host === 'localhost' || !host.includes('.') || /\.(local|lan|home|internal|localdomain)$/.test(host)) {
      return `${host} is an address only your own network can reach. Telnyx needs the public address, the same one you use for the Telnyx webhook.`;
    }

    try {
      const resolver = new Resolver({ timeout: 4000, tries: 1 });
      resolver.setServers(['1.1.1.1', '8.8.8.8']);
      await resolver.resolve4(host).catch(async (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENODATA') return resolver.resolve6(host);
        throw error;
      });
      return null;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOTFOUND' || code === 'ENODATA') {
        return `${host} does not exist on the public internet, so Telnyx cannot reach it. Use the public address you set for the Telnyx webhook.`;
      }
      // The public name servers did not answer. That says nothing about the address, so do not block recordings.
      return null;
    }
  }

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

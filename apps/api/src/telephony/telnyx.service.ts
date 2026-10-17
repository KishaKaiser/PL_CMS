import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicKey, verify } from 'crypto';
import { PhonePromptService } from './phone-prompt.service';
import { PROMPT_DEFINITIONS, PROMPT_KEYS, PromptKey, Say, textOf } from './phone-prompts';

const TELNYX_API_BASE = 'https://api.telnyx.com/v2';

/** Wraps a raw 32-byte Ed25519 public key into the SPKI DER form Node can load. */
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/** Webhooks older than this are rejected, to stop captured requests being replayed. */
const WEBHOOK_TOLERANCE_SECONDS = 300;

export type CallLeg = 'client' | 'advisor';

/** What a leg is doing: waiting for the caller to press 1, or hearing a goodbye before hanging up. */
export type CallStep = 'consent' | 'goodbye';

/** Travels with each Telnyx call leg and comes back, base64-encoded, on every webhook. */
export interface CallState {
  sessionId: string;
  leg: CallLeg;
  step?: CallStep;
  /** Set when this prompt was played as a recording, so a prompt that produced no key press can be repeated aloud. */
  audioKey?: PromptKey;
}

/** Where an incoming hotline call is in the menu, before it has become a billed session. */
export type HotlineStep = 'greeting' | 'menu' | 'queue-offer' | 'goodbye';

/** Travels with an incoming hotline call (which has no session yet) and comes back on every webhook. */
export interface HotlineState {
  hotline: true;
  step: HotlineStep;
  /** The caller's number as presented to us. */
  from?: string;
  /** The client account the caller's number belongs to, once identified. */
  clientId?: string;
  /** The advisor being offered a callback. */
  advisorId?: string;
  /** How many times the menu has been played, so a caller cannot be stuck in it forever. */
  tries?: number;
  /** Set when this prompt was played as a recording, so a prompt that produced no key press can be repeated aloud. */
  audioKey?: PromptKey;
}

/** Either kind of state a call leg can carry. */
export type LegState = CallState | HotlineState;

export interface DialOptions {
  to: string;
  state: CallState;
  timeoutSecs: number;
}

/** Spoken voice for prompts (Telnyx format <Provider>.<Voice>); override with TELNYX_TTS_VOICE. */
const DEFAULT_TTS_VOICE = 'AWS.Polly.Joanna';

@Injectable()
export class TelnyxService {
  private readonly logger = new Logger(TelnyxService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prompts: PhonePromptService,
  ) {}

  /** Places an outbound call and returns the new leg's call-control id. */
  async dial(options: DialOptions): Promise<{ callControlId: string }> {
    const body: Record<string, unknown> = {
      connection_id: this.requireConfig('TELNYX_CONNECTION_ID'),
      from: this.requireConfig('TELNYX_FROM_NUMBER'),
      to: options.to,
      timeout_secs: options.timeoutSecs,
      client_state: encodeState(options.state),
    };

    const response = await this.request('/calls', body);
    if (!response.ok) {
      const detail = await response.text();
      this.logger.error(`Telnyx dial failed (${response.status}): ${detail}`);
      throw new BadGatewayException('The phone service could not place the call. Please try again.');
    }

    const json = (await response.json()) as { data?: { call_control_id?: string } };
    const callControlId = json.data?.call_control_id;
    if (!callControlId) {
      this.logger.error('Telnyx dial response did not include a call_control_id');
      throw new BadGatewayException('The phone service could not place the call. Please try again.');
    }
    return { callControlId };
  }

  /** Plays a spoken prompt and waits for the caller to press 1; the result arrives as a call.gather.ended webhook. */
  async promptToPressOne(callControlId: string, say: Say, state: LegState): Promise<void> {
    const audioUrl = await this.recordingFor(say);
    if (audioUrl) {
      const invalidAudioUrl = await this.recordingFor({ key: 'call.invalid-choice', text: '' });
      const played = await this.command(callControlId, 'gather_using_audio', {
        audio_url: audioUrl,
        ...(invalidAudioUrl ? { invalid_audio_url: invalidAudioUrl } : {}),
        minimum_digits: 1,
        maximum_digits: 1,
        valid_digits: '1',
        maximum_tries: 2,
        timeout_millis: 10_000,
        client_state: encodeState({ ...state, audioKey: (say as { key: PromptKey }).key }),
      });
      if (played.ok) {
        this.logger.log(`Playing the recording for ${(say as { key: string }).key}`);
        return;
      }
      this.logger.warn(`Telnyx could not play the recording (${played.status}): ${await played.text()}. Using the computer voice.`);
    }

    const text = textOf(say);
    const response = await this.command(callControlId, 'gather_using_speak', {
      payload: text,
      voice: this.config.get<string>('TELNYX_TTS_VOICE') || DEFAULT_TTS_VOICE,
      minimum_digits: 1,
      maximum_digits: 1,
      valid_digits: '1',
      maximum_tries: 2,
      timeout_millis: 10_000,
      invalid_payload: 'That was not a valid choice.',
      client_state: encodeState(state),
    });
    if (!response.ok) {
      this.logger.error(`Telnyx prompt failed (${response.status}): ${await response.text()}`);
      throw new BadGatewayException('The phone service could not play the prompt.');
    }
  }

  /** Speaks a message to one leg; a call.speak.ended webhook follows when it finishes. */
  async speak(callControlId: string, say: Say, state: LegState): Promise<boolean> {
    try {
      const audioUrl = await this.recordingFor(say);
      if (audioUrl) {
        const played = await this.command(callControlId, 'playback_start', {
          audio_url: audioUrl,
          client_state: encodeState(state),
        });
        if (played.ok) return true;
        if (played.status === 404 || played.status === 422) {
          // The leg is already gone; there is nobody to speak to.
          return false;
        }
        this.logger.warn(`Telnyx could not play the recording (${played.status}): ${await played.text()}. Using the computer voice.`);
      }

      const text = textOf(say);
      const response = await this.command(callControlId, 'speak', {
        payload: text,
        voice: this.config.get<string>('TELNYX_TTS_VOICE') || DEFAULT_TTS_VOICE,
        client_state: encodeState(state),
      });
      if (!response.ok && response.status !== 404 && response.status !== 422) {
        this.logger.error(`Telnyx speak failed (${response.status}): ${await response.text()}`);
      }
      return response.ok;
    } catch (error) {
      this.logger.error(`Telnyx speak failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /** Answers an incoming call; a call.answered webhook follows. */
  async answer(callControlId: string, state: HotlineState): Promise<void> {
    const response = await this.command(callControlId, 'answer', { client_state: encodeState(state) });
    if (!response.ok) {
      this.logger.error(`Telnyx answer failed (${response.status}): ${await response.text()}`);
      throw new BadGatewayException('The phone service could not answer the call.');
    }
  }

  /**
   * Plays a prompt and collects digits (ended with #, or after a short pause). The result arrives as a
   * call.gather.ended webhook; no digits means the caller pressed nothing.
   */
  async gatherDigits(callControlId: string, say: Say, state: HotlineState, maxDigits: number): Promise<void> {
    const audioUrl = await this.recordingFor(say);
    if (audioUrl) {
      const played = await this.command(callControlId, 'gather_using_audio', {
        audio_url: audioUrl,
        minimum_digits: 1,
        maximum_digits: maxDigits,
        terminating_digit: '#',
        valid_digits: '0123456789',
        maximum_tries: 1,
        timeout_millis: 15_000,
        inter_digit_timeout_millis: 6_000,
        client_state: encodeState({ ...state, audioKey: (say as { key: PromptKey }).key }),
      });
      if (played.ok) {
        this.logger.log(`Playing the recording for ${(say as { key: string }).key}`);
        return;
      }
      this.logger.warn(`Telnyx could not play the recording (${played.status}): ${await played.text()}. Using the computer voice.`);
    }

    const text = textOf(say);
    const response = await this.command(callControlId, 'gather_using_speak', {
      payload: text,
      voice: this.config.get<string>('TELNYX_TTS_VOICE') || DEFAULT_TTS_VOICE,
      minimum_digits: 1,
      maximum_digits: maxDigits,
      terminating_digit: '#',
      valid_digits: '0123456789',
      maximum_tries: 1,
      timeout_millis: 15_000,
      inter_digit_timeout_millis: 6_000,
      client_state: encodeState(state),
    });
    if (!response.ok) {
      this.logger.error(`Telnyx gather failed (${response.status}): ${await response.text()}`);
      throw new BadGatewayException('The phone service could not play the menu.');
    }
  }

  /**
   * A recording was played but nothing was pressed, which is what a recording Telnyx could not fetch or play looks
   * like. Say the same line in the computer voice, once.
   */
  async repeatInComputerVoice(callControlId: string, state: LegState, maxDigits = 6): Promise<void> {
    const key = state.audioKey;
    const definition = PROMPT_DEFINITIONS.find((candidate) => candidate.key === key);
    const { audioKey: _played, ...plain } = state;
    const text = definition?.recordingText ?? 'Please make your selection now.';
    if ('hotline' in plain && plain.step === 'menu') {
      await this.gatherDigits(callControlId, text, plain, maxDigits);
    } else {
      await this.promptToPressOne(callControlId, text, plain);
    }
  }

  /** Connects two answered legs so the client and advisor can talk. */
  async bridge(callControlId: string, otherCallControlId: string): Promise<void> {
    const response = await this.command(callControlId, 'bridge', { call_control_id: otherCallControlId });
    if (!response.ok) {
      this.logger.error(`Telnyx bridge failed (${response.status}): ${await response.text()}`);
      throw new BadGatewayException('The phone service could not connect the call.');
    }
  }

  /** Hangs up one leg. A leg that has already ended is not an error. */
  async hangup(callControlId: string | null | undefined): Promise<void> {
    if (!callControlId) return;
    try {
      const response = await this.request(`/calls/${encodeURIComponent(callControlId)}/actions/hangup`, {});
      // 404/422: the leg is already gone, which is exactly the state we want.
      if (!response.ok && response.status !== 404 && response.status !== 422) {
        this.logger.error(`Telnyx hangup failed (${response.status}): ${await response.text()}`);
      }
    } catch (error) {
      this.logger.error(`Telnyx hangup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /** Throws unless the request was signed by Telnyx (Ed25519 over "timestamp|rawBody"). */
  verifyWebhook(headers: Record<string, string | string[] | undefined>, rawBody: string): void {
    const publicKeyB64 = this.config.get<string>('TELNYX_PUBLIC_KEY');
    if (!publicKeyB64) {
      throw new UnauthorizedException('TELNYX_PUBLIC_KEY is not configured');
    }

    const signature = headerValue(headers['telnyx-signature-ed25519']);
    const timestamp = headerValue(headers['telnyx-timestamp']);
    if (!signature || !timestamp) {
      throw new UnauthorizedException('Missing Telnyx signature headers');
    }

    const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(ageSeconds) || ageSeconds > WEBHOOK_TOLERANCE_SECONDS) {
      throw new UnauthorizedException('Stale Telnyx webhook');
    }

    let valid = false;
    try {
      const key = createPublicKey({
        key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyB64, 'base64')]),
        format: 'der',
        type: 'spki',
      });
      valid = verify(null, Buffer.from(`${timestamp}|${rawBody}`), key, Buffer.from(signature, 'base64'));
    } catch {
      valid = false;
    }
    if (!valid) {
      throw new UnauthorizedException('Invalid Telnyx webhook signature');
    }
  }

  /** The recording to play for this line, if one has been uploaded and Telnyx can fetch it. */
  private async recordingFor(say: Say): Promise<string | null> {
    if (typeof say === 'string') return null;
    try {
      return await this.prompts.audioUrl(say.key);
    } catch {
      return null;
    }
  }

  private command(callControlId: string, action: string, body: unknown) {
    return this.request(`/calls/${encodeURIComponent(callControlId)}/actions/${action}`, body);
  }

  private request(path: string, body: unknown) {
    return fetch(`${TELNYX_API_BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.requireConfig('TELNYX_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  private requireConfig(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) {
      this.logger.error(`${key} is not configured`);
      throw new ServiceUnavailableException('Phone calling is not set up yet.');
    }
    return value;
  }
}

export function encodeState(state: LegState): string {
  return Buffer.from(JSON.stringify(state)).toString('base64');
}

export function decodeState(encoded: string | undefined): CallState | null {
  if (!encoded) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8')) as Partial<CallState>;
    if (typeof parsed.sessionId === 'string' && (parsed.leg === 'client' || parsed.leg === 'advisor')) {
      const step = parsed.step === 'consent' || parsed.step === 'goodbye' ? parsed.step : undefined;
      const audioKey = typeof parsed.audioKey === 'string' && PROMPT_KEYS.has(parsed.audioKey) ? (parsed.audioKey as PromptKey) : undefined;
      return { sessionId: parsed.sessionId, leg: parsed.leg, ...(step ? { step } : {}), ...(audioKey ? { audioKey } : {}) };
    }
  } catch {
    // fall through
  }
  return null;
}

/** The state of a hotline call, or null if the call is not (or no longer) in the hotline menu. */
export function decodeHotlineState(encoded: string | undefined): HotlineState | null {
  if (!encoded) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8')) as Partial<HotlineState>;
    const steps: HotlineStep[] = ['greeting', 'menu', 'queue-offer', 'goodbye'];
    if (parsed.hotline === true && parsed.step && steps.includes(parsed.step)) {
      return {
        hotline: true,
        step: parsed.step,
        ...(typeof parsed.from === 'string' ? { from: parsed.from } : {}),
        ...(typeof parsed.clientId === 'string' ? { clientId: parsed.clientId } : {}),
        ...(typeof parsed.advisorId === 'string' ? { advisorId: parsed.advisorId } : {}),
        ...(typeof parsed.tries === 'number' ? { tries: parsed.tries } : {}),
        ...(typeof parsed.audioKey === 'string' && PROMPT_KEYS.has(parsed.audioKey) ? { audioKey: parsed.audioKey as PromptKey } : {}),
      };
    }
  } catch {
    // fall through
  }
  return null;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

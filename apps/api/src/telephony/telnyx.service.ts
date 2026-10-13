import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicKey, verify } from 'crypto';

const TELNYX_API_BASE = 'https://api.telnyx.com/v2';

/** Wraps a raw 32-byte Ed25519 public key into the SPKI DER form Node can load. */
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/** Webhooks older than this are rejected, to stop captured requests being replayed. */
const WEBHOOK_TOLERANCE_SECONDS = 300;

export type CallLeg = 'client' | 'advisor';

/** Travels with each Telnyx call leg and comes back, base64-encoded, on every webhook. */
export interface CallState {
  sessionId: string;
  leg: CallLeg;
}

export interface DialOptions {
  to: string;
  state: CallState;
  timeoutSecs: number;
  /** Call-control id of an already-answered leg to bridge this new leg to. */
  linkTo?: string;
}

@Injectable()
export class TelnyxService {
  private readonly logger = new Logger(TelnyxService.name);

  constructor(private readonly config: ConfigService) {}

  /** Places an outbound call and returns the new leg's call-control id. */
  async dial(options: DialOptions): Promise<{ callControlId: string }> {
    const body: Record<string, unknown> = {
      connection_id: this.requireConfig('TELNYX_CONNECTION_ID'),
      from: this.requireConfig('TELNYX_FROM_NUMBER'),
      to: options.to,
      timeout_secs: options.timeoutSecs,
      client_state: encodeState(options.state),
    };
    if (options.linkTo) {
      body.link_to = options.linkTo;
      body.bridge_on_answer = true;
    }

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

export function encodeState(state: CallState): string {
  return Buffer.from(JSON.stringify(state)).toString('base64');
}

export function decodeState(encoded: string | undefined): CallState | null {
  if (!encoded) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8')) as Partial<CallState>;
    if (typeof parsed.sessionId === 'string' && (parsed.leg === 'client' || parsed.leg === 'advisor')) {
      return { sessionId: parsed.sessionId, leg: parsed.leg };
    }
  } catch {
    // fall through
  }
  return null;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

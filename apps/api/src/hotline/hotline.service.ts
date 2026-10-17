import { HttpException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BillingService,
  LIVE_STATUSES,
  MIN_CALL_MINUTES,
  TelnyxWebhookPayload,
  toCents,
} from '../billing/billing.service';
import { CallbacksService } from '../callbacks/callbacks.service';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePhoneNumber } from '../telephony/phone-number';
import type { Say, Spoken } from '../telephony/phone-prompts';
import { HotlineState, TelnyxService, decodeHotlineState } from '../telephony/telnyx.service';

/** The longest extension a caller can key in. */
const MAX_EXTENSION_DIGITS = 6;

/** How many times a caller may key in an extension that does not exist before we give up. */
const MAX_MENU_TRIES = 3;

/** How long a caller who asks for a callback is willing to wait: for an advisor who is offline, as long as it takes. */
const OFFLINE_WAIT_MINUTES = 999 * 60;
const BUSY_WAIT_MINUTES = 120;

const GREETING = 'Welcome to The Psychic Link.';
const MENU_PROMPT =
  "Please enter your advisor's extension, followed by the pound key. Or press 0 to be connected with the first available advisor.";

// Each fixed line carries its key, so an uploaded recording is played instead of the computer voice when there is one.
const MENU: Spoken = { key: 'hotline.menu', text: `${GREETING} ${MENU_PROMPT}` };
const MENU_RETRY: Spoken = { key: 'hotline.menu-retry', text: `We could not find that extension. ${MENU_PROMPT}` };
const NO_ACCOUNT_MESSAGE: Spoken = {
  key: 'hotline.no-account',
  text: 'We could not find an account for the phone number you are calling from. Please sign in to The Psychic Link website and save this phone number to your account, then call again. Goodbye.',
};
const NOTHING_ENTERED_MESSAGE: Spoken = {
  key: 'hotline.nothing-entered',
  text: 'We did not receive a selection. Please call again. Goodbye.',
};
const EXTENSION_NOT_FOUND_MESSAGE: Spoken = {
  key: 'hotline.extension-not-found',
  text: 'We could not find that extension. Please check it and call again. Goodbye.',
};
const NO_ADVISORS_MESSAGE: Spoken = {
  key: 'hotline.no-advisors',
  text: 'We are sorry, no advisors are available right now. Please try again later. Goodbye.',
};
const ALL_BUSY_MESSAGE: Spoken = {
  key: 'hotline.all-busy',
  text: 'We are sorry, all of our advisors are with other callers right now. Please try again in a few minutes. Goodbye.',
};
const BALANCE_TOO_LOW_MESSAGE: Spoken = {
  key: 'hotline.balance-too-low',
  text: 'Your wallet balance is too low for the advisors who are available. Please add funds on The Psychic Link website and call again. Goodbye.',
};
const GOODBYE: Spoken = { key: 'hotline.goodbye', text: 'Goodbye.' };
const GENERIC_FAILURE_MESSAGE: Spoken = {
  key: 'hotline.generic-failure',
  text: 'We are sorry, we could not connect your call. You have not been charged. Please try again later. Goodbye.',
};

/**
 * The dial-in hotline. A caller phones the toll-free number, is recognised by the phone number they are calling
 * from, keys in an advisor's extension (or 0 for the first available advisor) and is connected through the same
 * press-1 flow, free period and billing as every other call. An advisor who is busy or offline can be asked for a
 * callback, which puts the caller in that advisor's line.
 */
@Injectable()
export class HotlineService implements OnModuleInit {
  private readonly logger = new Logger(HotlineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telnyx: TelnyxService,
    private readonly billing: BillingService,
    private readonly callbacks: CallbacksService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.billing.registerInboundHandler((eventType, payload) => this.handle(eventType, payload));
  }

  /** The hotline's number in the form Telnyx reports it, or null if the hotline is not set up. */
  get hotlineNumber(): string | null {
    const configured = this.config.get<string>('TELNYX_HOTLINE_NUMBER');
    return configured ? normalizePhoneNumber(configured) : null;
  }

  async handle(eventType: string | undefined, payload: TelnyxWebhookPayload): Promise<{ ok: boolean }> {
    const callControlId = payload.call_control_id;
    if (!callControlId) return { ok: true };

    try {
      const state = decodeHotlineState(payload.client_state);

      if (!state) {
        if (eventType === 'call.initiated' && payload.direction === 'incoming') {
          await this.onIncoming(callControlId, payload);
        }
        return { ok: true };
      }

      switch (eventType) {
        case 'call.answered':
          if (state.step === 'greeting') await this.onAnswered(callControlId, state);
          break;
        case 'call.gather.ended':
          await this.onGatherEnded(callControlId, state, payload.digits);
          break;
        case 'call.speak.ended':
        case 'call.playback.ended':
          if (state.step === 'goodbye') await this.telnyx.hangup(callControlId);
          break;
        default:
          break;
      }
    } catch (error) {
      this.logger.error(`Hotline could not handle ${eventType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      await this.telnyx.hangup(callControlId);
    }
    return { ok: true };
  }

  // ── Steps ──────────────────────────────────────────────────────────────────

  /** A call came in. Only calls to the hotline number are answered. */
  private async onIncoming(callControlId: string, payload: TelnyxWebhookPayload) {
    const hotline = this.hotlineNumber;
    const dialed = payload.to ? normalizePhoneNumber(payload.to) : null;
    if (!hotline || !dialed || dialed !== hotline) return;

    this.logger.log(`Hotline call from ${payload.from ?? 'an unknown number'}`);
    await this.telnyx.answer(callControlId, { hotline: true, step: 'greeting', from: payload.from });
  }

  /** The caller is on the line: work out whose account they are calling from, then play the menu. */
  private async onAnswered(callControlId: string, state: HotlineState) {
    const from = state.from ? normalizePhoneNumber(state.from) : null;
    const matches = from
      ? await this.prisma.clientProfile.findMany({ where: { phoneNumber: from }, select: { id: true }, take: 2 })
      : [];

    // No caller ID, no account with this number, or a number shared by several accounts: we cannot bill anyone.
    if (matches.length !== 1) {
      await this.finish(callControlId, NO_ACCOUNT_MESSAGE);
      return;
    }

    await this.playMenu(callControlId, { hotline: true, step: 'menu', clientId: matches[0].id, tries: 1 }, false);
  }

  private async playMenu(callControlId: string, state: HotlineState, retry: boolean) {
    await this.telnyx.gatherDigits(callControlId, retry ? MENU_RETRY : MENU, { ...state, step: 'menu' }, MAX_EXTENSION_DIGITS);
  }

  private async onGatherEnded(callControlId: string, state: HotlineState, digits: string | undefined) {
    if (state.step === 'menu') return this.onMenuChoice(callControlId, state, digits?.trim() ?? '');
    if (state.step === 'queue-offer') return this.onQueueOffer(callControlId, state, digits);
  }

  private async onMenuChoice(callControlId: string, state: HotlineState, digits: string) {
    if (!state.clientId) return this.finish(callControlId, GENERIC_FAILURE_MESSAGE);
    if (!digits) return this.finish(callControlId, NOTHING_ENTERED_MESSAGE);

    if (digits === '0') return this.connectToFirstAvailable(callControlId, state);

    const advisor = await this.prisma.advisorProfile.findFirst({
      where: { sipExtension: digits, phoneNumber: { not: null }, ratePerMinute: { gt: 0 } },
      select: { id: true, displayName: true },
    });

    if (!advisor) {
      const tries = state.tries ?? 1;
      if (tries >= MAX_MENU_TRIES) {
        return this.finish(callControlId, EXTENSION_NOT_FOUND_MESSAGE);
      }
      return this.playMenu(callControlId, { ...state, tries: tries + 1 }, true);
    }

    return this.connect(callControlId, state, advisor.id);
  }

  /** Press 0: the advisor who is free and has gone longest without a call, among those the caller can afford. */
  private async connectToFirstAvailable(callControlId: string, state: HotlineState) {
    const client = await this.prisma.clientProfile.findUnique({
      where: { id: state.clientId },
      select: { balanceCents: true },
    });
    if (!client) return this.finish(callControlId, GENERIC_FAILURE_MESSAGE);

    const online = await this.prisma.advisorProfile.findMany({
      where: { isOnline: true, phoneNumber: { not: null }, ratePerMinute: { gt: 0 } },
      select: { id: true, ratePerMinute: true },
    });
    if (online.length === 0) {
      return this.finish(callControlId, NO_ADVISORS_MESSAGE);
    }
    const ids = online.map((advisor) => advisor.id);

    const [onCall, waiting, lastCalls] = await Promise.all([
      this.prisma.callSession.findMany({
        where: { status: { in: LIVE_STATUSES }, advisorId: { in: ids } },
        select: { advisorId: true },
      }),
      this.prisma.queueAssignment.findMany({
        where: { status: { in: ['WAITING', 'CALLING'] }, queue: { advisorId: { in: ids } } },
        select: { queue: { select: { advisorId: true } } },
      }),
      this.prisma.callSession.groupBy({
        by: ['advisorId'],
        where: { advisorId: { in: ids }, endedAt: { not: null } },
        _max: { endedAt: true },
      }),
    ]);

    const taken = new Set([...onCall.map((s) => s.advisorId), ...waiting.map((w) => w.queue.advisorId)]);
    const free = online.filter((advisor) => !taken.has(advisor.id));
    if (free.length === 0) {
      return this.finish(callControlId, ALL_BUSY_MESSAGE);
    }

    const affordable = free.filter((advisor) => client.balanceCents >= toCents(advisor.ratePerMinute) * MIN_CALL_MINUTES);
    if (affordable.length === 0) {
      return this.finish(callControlId, BALANCE_TOO_LOW_MESSAGE);
    }

    // Never-called advisors first, then whoever has been quiet the longest.
    const lastEnded = new Map(lastCalls.map((row) => [row.advisorId, row._max.endedAt?.getTime() ?? 0]));
    affordable.sort((a, b) => (lastEnded.get(a.id) ?? 0) - (lastEnded.get(b.id) ?? 0));

    return this.connect(callControlId, state, affordable[0].id);
  }

  /** Starts the billed call, or explains why it cannot, or offers a callback if the advisor is not free. */
  private async connect(callControlId: string, state: HotlineState, advisorId: string) {
    if (!state.clientId) return this.finish(callControlId, GENERIC_FAILURE_MESSAGE);

    try {
      await this.billing.startInboundCall(state.clientId, advisorId, callControlId);
      return; // the billing flow asks the caller to press 1 and takes it from here
    } catch (error) {
      const message = errorMessage(error);
      const advisor = await this.prisma.advisorProfile.findUnique({
        where: { id: advisorId },
        select: { displayName: true, isOnline: true },
      });

      // Busy, queued up, or offline: offer to call the caller back instead.
      const notFree = !advisor?.isOnline || /on another call|waiting for this advisor/i.test(message);
      if (advisor && notFree && !/wallet/i.test(message)) {
        const reason = advisor.isOnline ? 'with another caller' : 'not available';
        await this.telnyx.promptToPressOne(
          callControlId,
          {
            key: 'hotline.callback-offer',
            text: `${advisor.displayName} is ${reason} right now. To have us call you back at this number as soon as they are free, press 1. Otherwise, you can hang up.`,
          },
          { hotline: true, step: 'queue-offer', clientId: state.clientId, advisorId },
        );
        return;
      }

      this.logger.warn(`Hotline call could not start: ${message}`);
      await this.finish(callControlId, `${message.replace(/\.$/, '')}. Goodbye.`);
    }
  }

  private async onQueueOffer(callControlId: string, state: HotlineState, digits: string | undefined) {
    if (digits !== '1' || !state.clientId || !state.advisorId) {
      return this.finish(callControlId, GOODBYE);
    }

    const [client, advisor] = await Promise.all([
      this.prisma.clientProfile.findUnique({ where: { id: state.clientId }, select: { userId: true } }),
      this.prisma.advisorProfile.findUnique({ where: { id: state.advisorId }, select: { displayName: true, isOnline: true } }),
    ]);
    if (!client || !advisor) return this.finish(callControlId, GENERIC_FAILURE_MESSAGE);

    try {
      const result = await this.callbacks.join(client.userId, {
        advisorId: state.advisorId,
        maxWaitMinutes: advisor.isOnline ? BUSY_WAIT_MINUTES : OFFLINE_WAIT_MINUTES,
      });
      const entry = 'entry' in result ? result.entry : null;
      const place = entry && entry.position > 0 ? ` You are number ${entry.position} in line.` : '';
      await this.finish(
        callControlId,
        `Thank you.${place} We will call you back at this number as soon as ${advisor.displayName} is available. Goodbye.`,
      );
    } catch (error) {
      const message = errorMessage(error);
      this.logger.warn(`Hotline callback request failed: ${message}`);
      await this.finish(callControlId, `${message.replace(/\.$/, '')}. Goodbye.`);
    }
  }

  /** Says a last message and hangs up when it has finished. */
  private async finish(callControlId: string, say: Say) {
    const spoke = await this.telnyx.speak(callControlId, say, { hotline: true, step: 'goodbye' });
    if (!spoke) await this.telnyx.hangup(callControlId);
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'string') return response;
    const message = (response as { message?: string | string[] }).message;
    if (Array.isArray(message)) return message.join(' ');
    if (message) return message;
  }
  return error instanceof Error ? error.message : GENERIC_FAILURE_MESSAGE.text;
}

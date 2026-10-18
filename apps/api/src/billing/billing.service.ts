import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { AdvisorProfile, ClientProfile } from '@pl-cms/db';
import { PrismaService } from '../prisma/prisma.service';
import type { Spoken } from '../telephony/phone-prompts';
import { CallLeg, CallState, TelnyxService, decodeState } from '../telephony/telnyx.service';
import { MAX_TOP_UP_CENTS, MIN_TOP_UP_CENTS, PaypalWalletService } from '../wallet/paypal-wallet.service';
import { StartSessionDto } from './billing.dto';

/** How often a connected call is charged another minute. */
const TICK_INTERVAL_MS = 60_000;

/** A client needs at least this many minutes of the advisor's rate to start a call. */
export const MIN_CALL_MINUTES = 2;

const CLIENT_RING_SECONDS = 40;
const ADVISOR_RING_SECONDS = 30;

/** A call that hasn't connected after this long is treated as dead and cleaned up. */
const STALE_PENDING_MS = 3 * 60_000;

/** Free seconds after the two parties are connected before billing starts (admin Settings → Telephony can change it). */
const DEFAULT_BILLING_DELAY_SECONDS = 45;
const MAX_BILLING_DELAY_SECONDS = 300;
const TELEPHONY_SETTINGS_KEY = 'telephony_settings';

// What each party hears. Spoken with a text-to-speech voice.
// Each fixed line carries its key, so an uploaded recording is played instead of the computer voice when there is one.
const CLIENT_PROMPT: Spoken = {
  key: 'call.client-press1',
  text: 'Welcome to The Psychic Link. To begin your call, press 1 now.',
};
const ADVISOR_PROMPT: Spoken = {
  key: 'call.advisor-press1',
  text: 'You have a call from The Psychic Link. Press 1 to accept this call.',
};
const scheduledClientPrompt = (advisorName: string): Spoken => ({
  key: 'call.client-press1-scheduled',
  text: `Welcome to The Psychic Link. This is your scheduled call with ${advisorName}. To begin your call, press 1 now.`,
});
const SCHEDULED_ADVISOR_PROMPT: Spoken = {
  key: 'call.advisor-press1-scheduled',
  text: 'You have a scheduled call from The Psychic Link. Press 1 to accept this call.',
};
const queuedClientPrompt = (advisorName: string): Spoken => ({
  key: 'call.client-press1-callback',
  text: `Welcome to The Psychic Link. ${advisorName} is ready to take your call now. To begin your call, press 1 now.`,
});
const QUEUED_ADVISOR_PROMPT: Spoken = {
  key: 'call.advisor-press1-callback',
  text: 'The next client in your queue is ready. Press 1 to accept this call.',
};
/** "2 dollars", "2 dollars and 50 cents": amounts read out by the voice. */
function spokenAmount(cents: number): string {
  const dollars = Math.floor(cents / 100);
  const rest = cents % 100;
  const dollarText = `${dollars} ${dollars === 1 ? 'dollar' : 'dollars'}`;
  return rest === 0 ? dollarText : `${dollarText} and ${rest} ${rest === 1 ? 'cent' : 'cents'}`;
}
const inboundClientPrompt = (advisorName: string, rateCents: number) =>
  `You have chosen ${advisorName}, at ${spokenAmount(rateCents)} per minute. To connect now, press 1.`;
const CLIENT_UNAVAILABLE_MESSAGE: Spoken = {
  key: 'call.advisor-unavailable',
  text: 'We are sorry, your advisor is unavailable right now. You have not been charged. Goodbye.',
};
const CLIENT_LOW_BALANCE_WARNING: Spoken = {
  key: 'call.low-balance-client',
  text: 'Your balance is running low. This call will end in about one minute unless you add funds to your wallet on the website.',
};
const ADVISOR_LOW_BALANCE_WARNING: Spoken = {
  key: 'call.low-balance-advisor',
  text: "The client's balance is running low. This call will end in about one minute.",
};
/** The menu a client with a saved PayPal wallet hears with the low-balance warning. */
const TOP_UP_MENU =
  'Your balance is running low, and this call will end in about one minute. To add money from your PayPal wallet, press 1 for 10 dollars, 2 for 20 dollars, 3 for 50 dollars, 4 to enter an amount of your choice, or 9 to continue without adding money.';
const TOP_UP_AMOUNT_PROMPT = 'Enter the amount in dollars, from 5 to 100, followed by the pound key.';
const TOP_UP_AMOUNT_RETRY = 'That amount is not allowed. Enter an amount in dollars from 5 to 100, followed by the pound key.';
const TOP_UP_DECLINED = 'No problem. Your call will end in about one minute unless you add funds on the website.';
const TOP_UP_FAILED = 'We could not add funds just now. You can add funds on the website to keep talking.';
const TOP_UP_DECLINED_BY_PAYPAL = 'PayPal did not accept that payment. You can add funds on the website to keep talking.';
const TOP_UP_PRESETS: Record<string, number> = { '1': 1000, '2': 2000, '3': 5000 };

const CLIENT_OUT_OF_FUNDS_MESSAGE: Spoken = {
  key: 'call.out-of-funds-client',
  text: 'Your balance has run out, so this call is ending. Goodbye.',
};
const ADVISOR_OUT_OF_FUNDS_MESSAGE: Spoken = {
  key: 'call.out-of-funds-advisor',
  text: "The client's balance has run out, so this call is ending. Goodbye.",
};

/**
 * How long before the next charge the low-balance warning is spoken. Each minute is charged up front, so a
 * lead equal to the billing interval means the warning plays at the start of the final minute the client can pay for.
 */
const LOW_BALANCE_WARNING_LEAD_MS = TICK_INTERVAL_MS;

/** If a goodbye message's end is never reported, hang up anyway after this long. */
const GOODBYE_BACKSTOP_MS = 8_000;

/** Statuses of a call that is still being set up or in progress. */
export const LIVE_STATUSES = ['PENDING_CONNECTION', 'AWAITING_CLIENT', 'DIALING_ADVISOR', 'CONNECTED', 'BILLING_ACTIVE'];

/** Statuses where the two parties are talking: free period (CONNECTED) or billed (BILLING_ACTIVE). */
const TALKING_STATUSES = ['CONNECTED', 'BILLING_ACTIVE'];

export interface TelnyxWebhookBody {
  data?: {
    event_type?: string;
    payload?: TelnyxWebhookPayload;
  };
}

export interface TelnyxWebhookPayload {
  call_control_id?: string;
  direction?: string;
  from?: string;
  to?: string;
  client_state?: string;
  hangup_cause?: string;
  hangup_source?: string;
  sip_hangup_cause?: string;
  digits?: string;
  status?: string;
  reason?: string;
}

/** Handles webhooks for calls that are not part of a billing session (the dial-in hotline). */
export type InboundCallHandler = (eventType: string | undefined, payload: TelnyxWebhookPayload) => Promise<{ ok: boolean }>;

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private inboundHandler: InboundCallHandler | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telnyx: TelnyxService,
    private readonly wallets: PaypalWalletService,
  ) {}

  /** The hotline registers itself here so incoming calls reach it through the same webhook. */
  registerInboundHandler(handler: InboundCallHandler) {
    this.inboundHandler = handler;
  }

  /** Checks the balance and availability, then rings the client to begin the call. */
  async startSession(userId: string, dto: StartSessionDto) {
    const client = await this.prisma.clientProfile.findUnique({ where: { userId } });
    if (!client) throw new NotFoundException('Client profile not found');

    const advisor = await this.prisma.advisorProfile.findUnique({ where: { id: dto.advisorId } });
    if (!advisor) throw new NotFoundException('Advisor not found');

    return this.placeCall(client, advisor, { requireOnline: true });
  }

  /**
   * Places the callback for an accepted appointment. It runs the same checks and the same press-1 call
   * flow as a live call, except the advisor does not have to be switched online: they agreed to take this
   * call at this time.
   */
  async startScheduledCall(appointment: { id: string; clientId: string; advisorId: string }) {
    const client = await this.prisma.clientProfile.findUnique({ where: { id: appointment.clientId } });
    if (!client) throw new NotFoundException('Client profile not found');

    const advisor = await this.prisma.advisorProfile.findUnique({ where: { id: appointment.advisorId } });
    if (!advisor) throw new NotFoundException('Advisor not found');

    return this.placeCall(client, advisor, { requireOnline: false, appointmentId: appointment.id });
  }

  /**
   * Places the callback for a client who was waiting in the advisor's queue. Same checks and press-1 flow as a live
   * call, and the advisor must still be online.
   */
  async startQueuedCall(assignment: { id: string; clientId: string; advisorId: string }) {
    const client = await this.prisma.clientProfile.findUnique({ where: { id: assignment.clientId } });
    if (!client) throw new NotFoundException('Client profile not found');

    const advisor = await this.prisma.advisorProfile.findUnique({ where: { id: assignment.advisorId } });
    if (!advisor) throw new NotFoundException('Advisor not found');

    return this.placeCall(client, advisor, { requireOnline: true, queueAssignmentId: assignment.id });
  }

  private async placeCall(
    client: ClientProfile,
    advisor: AdvisorProfile,
    options: { requireOnline: boolean; appointmentId?: string; queueAssignmentId?: string },
  ) {
    if (!client.phoneNumber) {
      throw new BadRequestException('Add your phone number so we know where to call you.');
    }
    await this.assertCanCall(client, advisor, options);

    const session = await this.prisma.callSession.create({
      data: { advisorId: advisor.id, clientId: client.id, status: 'PENDING_CONNECTION' },
    });

    // Link the appointment before dialing so the prompts can use the scheduled-call wording.
    if (options.appointmentId) {
      await this.prisma.appointment.update({
        where: { id: options.appointmentId },
        data: { callSessionId: session.id },
      });
    }

    // Same for a queued callback.
    if (options.queueAssignmentId) {
      await this.prisma.queueAssignment.update({
        where: { id: options.queueAssignmentId },
        data: { callSessionId: session.id },
      });
    } else if (options.requireOnline) {
      await this.settleQueueSpots(client.id, advisor.id);
    }

    try {
      const { callControlId } = await this.telnyx.dial({
        to: client.phoneNumber,
        state: { sessionId: session.id, leg: 'client' },
        timeoutSecs: CLIENT_RING_SECONDS,
      });
      await this.prisma.callSession.update({
        where: { id: session.id },
        data: { clientCallControlId: callControlId },
      });
    } catch (error) {
      await this.endSession(session.id, 'ENDED_NOT_CONNECTED');
      throw error;
    }

    return { id: session.id, status: session.status };
  }

  /**
   * A client who phoned the hotline and chose an advisor. They are already on the line, so there is no call to
   * place to them: the session starts at "waiting for the client to press 1", after we tell them the rate.
   * Throws (with a message that can be read out to the caller) if the call cannot go ahead.
   */
  async startInboundCall(clientId: string, advisorId: string, clientCallControlId: string) {
    const client = await this.prisma.clientProfile.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('We could not find your account.');

    const advisor = await this.prisma.advisorProfile.findUnique({ where: { id: advisorId } });
    if (!advisor) throw new NotFoundException('That advisor could not be found.');

    await this.assertCanCall(client, advisor, { requireOnline: true });

    const session = await this.prisma.callSession.create({
      data: { advisorId: advisor.id, clientId: client.id, status: 'AWAITING_CLIENT', clientCallControlId, source: 'HOTLINE' },
    });
    await this.settleQueueSpots(client.id, advisor.id);

    try {
      await this.telnyx.promptToPressOne(clientCallControlId, inboundClientPrompt(advisor.displayName, toCents(advisor.ratePerMinute)), {
        sessionId: session.id,
        leg: 'client',
        step: 'consent',
      });
    } catch (error) {
      await this.endSession(session.id, 'ENDED_NOT_CONNECTED');
      throw error;
    }

    return { id: session.id };
  }

  /** The rules every call has to pass, whoever starts it: the advisor is reachable, the wallet covers it, nobody is in the way. */
  private async assertCanCall(
    client: ClientProfile,
    advisor: AdvisorProfile,
    options: { requireOnline: boolean; queueAssignmentId?: string },
  ) {
    if (options.requireOnline && !advisor.isOnline) {
      throw new BadRequestException('This advisor is not taking calls right now.');
    }
    if (!advisor.phoneNumber) throw new BadRequestException('This advisor is not set up for phone calls yet.');

    const rateCents = toCents(advisor.ratePerMinute);
    if (rateCents <= 0) throw new BadRequestException('This advisor has not set a rate yet.');

    const requiredCents = rateCents * MIN_CALL_MINUTES;
    if (client.balanceCents < requiredCents) {
      throw new BadRequestException(
        `You need at least $${(requiredCents / 100).toFixed(2)} (${MIN_CALL_MINUTES} minutes) in your wallet to call this advisor.`,
      );
    }

    // Clients waiting in this advisor's queue go first: nobody can jump the line with Call Now.
    // (Appointments and the queue's own callbacks are exempt.)
    if (options.requireOnline && !options.queueAssignmentId) {
      const ahead = await this.prisma.queueAssignment.count({
        where: {
          status: { in: ['WAITING', 'CALLING'] },
          clientId: { not: client.id },
          queue: { advisorId: advisor.id },
        },
      });
      if (ahead > 0) {
        throw new ConflictException('Other clients are waiting for this advisor. Please join the queue.');
      }
    }

    const busy = await this.prisma.callSession.findFirst({
      where: { status: { in: LIVE_STATUSES }, OR: [{ clientId: client.id }, { advisorId: advisor.id }] },
      select: { clientId: true },
    });
    if (busy) {
      throw new ConflictException(
        busy.clientId === client.id
          ? 'You already have a call in progress.'
          : 'This advisor is on another call right now.',
      );
    }
  }

  /** An admin ends a call that is stuck or has gone wrong. Billing stops and both phone lines are dropped. */
  async endSessionAsAdmin(sessionId: string) {
    const ended = await this.endSession(sessionId, 'ENDED_BY_ADMIN');
    if (!ended) throw new BadRequestException('That call has already ended, or does not exist.');
    await this.terminateCall(sessionId);
    return {
      id: ended.id,
      durationSeconds: ended.durationSeconds ?? 0,
      billedMinutes: ended.billedMinutes ?? 0,
      billedAmountCents: ended.billedAmountCents ?? 0,
    };
  }

  /** Calling an advisor directly settles any spot this client had in their queue. */
  private async settleQueueSpots(clientId: string, advisorId: string) {
    await this.prisma.queueAssignment.updateMany({
      where: { clientId, status: 'WAITING', queue: { advisorId } },
      data: { status: 'CANCELLED' },
    });
  }

  async stopSession(sessionId: string, userId: string) {
    const session = await this.prisma.callSession.findUnique({
      where: { id: sessionId },
      include: { client: true, advisor: { select: { id: true, slug: true } } },
    });

    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
    if (session.client.userId !== userId) throw new ForbiddenException();
    if (session.status.startsWith('ENDED')) {
      throw new BadRequestException('Session is already ended');
    }

    const ended = await this.endSession(sessionId, 'ENDED_BY_USER');
    await this.terminateCall(sessionId);

    return {
      sessionId,
      // Lets the call-ended screen link to the advisor's profile, where the client can leave a review.
      advisorProfilePath: session.advisor.slug ?? session.advisor.id,
      status: 'ENDED_BY_USER',
      durationSeconds: ended?.durationSeconds ?? 0,
      billedMinutes: ended?.billedMinutes ?? 0,
      billedAmountCents: ended?.billedAmountCents ?? 0,
    };
  }

  async handleTelnyxWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
    body: TelnyxWebhookBody,
  ) {
    this.telnyx.verifyWebhook(headers, rawBody);

    const eventType = body.data?.event_type;
    const payload = body.data?.payload ?? {};
    const state = decodeState(payload.client_state);
    const callControlId = payload.call_control_id;

    // Not part of a billing session: either a call into the hotline, or one we don't act on.
    if (!state) {
      return this.inboundHandler ? this.inboundHandler(eventType, payload) : { ok: true };
    }
    if (!callControlId) return { ok: true };

    // Why a leg ended or what a party pressed is the first thing to look at when a call misbehaves.
    if (eventType === 'call.hangup') {
      this.logger.log(
        `${eventType} session=${state.sessionId} leg=${state.leg} cause=${payload.hangup_cause ?? '?'} sip=${payload.sip_hangup_cause ?? '?'} source=${payload.hangup_source ?? '?'}`,
      );
    } else if (eventType === 'call.gather.ended') {
      this.logger.log(
        `${eventType} session=${state.sessionId} leg=${state.leg} digits=${payload.digits ?? ''} status=${payload.status ?? '?'}`,
      );
    } else if (eventType === 'call.answered' || eventType === 'call.speak.ended' || eventType === 'call.playback.ended') {
      this.logger.log(
        `${eventType} session=${state.sessionId} leg=${state.leg}${payload.status ? ` status=${payload.status}` : ''}${payload.reason ? ` reason=${payload.reason}` : ''}`,
      );
    }

    switch (eventType) {
      case 'call.answered':
        return state.leg === 'client'
          ? this.onClientAnswered(state.sessionId, callControlId)
          : this.onAdvisorAnswered(state.sessionId, callControlId);

      case 'call.gather.ended':
        if (state.step === 'topup' || state.step === 'topup-amount' || state.step === 'topup-amount-retry') {
          return this.onTopUpChoice(state, callControlId, payload.digits);
        }
        // A recording that produced no key press may simply not have played: say it again in the computer voice before
        // treating the silence as the person declining.
        if (state.audioKey && !payload.digits && payload.status !== 'call_hangup') {
          this.logger.warn(
            `No key was pressed after the recording for ${state.audioKey} (status=${payload.status ?? '?'}); repeating it in the computer voice`,
          );
          await this.telnyx.repeatInComputerVoice(callControlId, state);
          return { ok: true };
        }
        return this.onGatherEnded(state.sessionId, state.leg, callControlId, payload.digits);

      case 'call.speak.ended':
      case 'call.playback.ended':
        // A goodbye (spoken or recorded) has finished playing: now hang up.
        if (state.step === 'goodbye') await this.telnyx.hangup(callControlId);
        return { ok: true };

      case 'call.hangup':
        return this.onLegHangup(state.sessionId, state.leg);

      default:
        return { ok: true };
    }
  }

  /** The client picked up: ask them to press 1 before we involve the advisor. */
  private async onClientAnswered(sessionId: string, clientCallControlId: string) {
    const session = await this.prisma.callSession.findUnique({
      where: { id: sessionId },
      select: {
        status: true,
        advisor: { select: { displayName: true } },
        appointment: { select: { id: true } },
        queueAssignment: { select: { id: true } },
      },
    });
    if (!session || session.status.startsWith('ENDED')) {
      await this.telnyx.hangup(clientCallControlId);
      return { ok: true };
    }

    // Claim the transition so a redelivered webhook can't play the prompt twice.
    const claim = await this.prisma.callSession.updateMany({
      where: { id: sessionId, status: 'PENDING_CONNECTION' },
      data: { status: 'AWAITING_CLIENT', clientCallControlId },
    });
    if (claim.count === 0) return { ok: true };

    try {
      await this.telnyx.promptToPressOne(
        clientCallControlId,
        session.appointment
          ? scheduledClientPrompt(session.advisor?.displayName ?? 'your advisor')
          : session.queueAssignment
            ? queuedClientPrompt(session.advisor?.displayName ?? 'your advisor')
            : CLIENT_PROMPT,
        { sessionId, leg: 'client', step: 'consent' },
      );
    } catch (error) {
      this.logger.error(
        `Could not prompt the client for session ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      await this.endSession(sessionId, 'ENDED_NOT_CONNECTED');
      await this.telnyx.hangup(clientCallControlId);
    }

    return { ok: true };
  }

  /** The advisor picked up: ask them to press 1 to accept before we connect anyone. */
  private async onAdvisorAnswered(sessionId: string, advisorCallControlId: string) {
    const session = await this.prisma.callSession.findUnique({
      where: { id: sessionId },
      select: { status: true, appointment: { select: { id: true } }, queueAssignment: { select: { id: true } } },
    });
    if (!session || session.status !== 'DIALING_ADVISOR') {
      await this.telnyx.hangup(advisorCallControlId);
      return { ok: true };
    }

    try {
      await this.telnyx.promptToPressOne(
        advisorCallControlId,
        session.appointment ? SCHEDULED_ADVISOR_PROMPT : session.queueAssignment ? QUEUED_ADVISOR_PROMPT : ADVISOR_PROMPT,
        { sessionId, leg: 'advisor', step: 'consent' },
      );
    } catch (error) {
      this.logger.error(
        `Could not prompt the advisor for session ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      await this.failSetup(sessionId);
    }

    return { ok: true };
  }

  /** A party finished the "press 1" prompt, whether or not they pressed it. */
  private async onGatherEnded(sessionId: string, leg: CallLeg, callControlId: string, digits: string | undefined) {
    const pressedOne = digits === '1';

    if (leg === 'client') {
      if (!pressedOne) {
        // The client didn't start the call: nothing to explain, nothing to charge.
        await this.endSession(sessionId, 'ENDED_NOT_CONNECTED');
        await this.terminateCall(sessionId);
        return { ok: true };
      }
      return this.dialAdvisor(sessionId, callControlId);
    }

    if (!pressedOne) {
      await this.failSetup(sessionId);
      return { ok: true };
    }
    return this.connectCall(sessionId, callControlId);
  }

  /** The client pressed 1: ring the advisor's own phone. */
  private async dialAdvisor(sessionId: string, clientCallControlId: string) {
    const session = await this.prisma.callSession.findUnique({
      where: { id: sessionId },
      include: { advisor: true },
    });
    if (!session || session.status.startsWith('ENDED')) {
      await this.telnyx.hangup(clientCallControlId);
      return { ok: true };
    }

    // Claim the transition so a redelivered webhook can't ring the advisor twice.
    const claim = await this.prisma.callSession.updateMany({
      where: { id: sessionId, status: 'AWAITING_CLIENT' },
      data: { status: 'DIALING_ADVISOR' },
    });
    if (claim.count === 0) return { ok: true };

    try {
      if (!session.advisor.phoneNumber) throw new Error('Advisor has no phone number on file');
      const { callControlId } = await this.telnyx.dial({
        to: session.advisor.phoneNumber,
        state: { sessionId, leg: 'advisor' },
        timeoutSecs: ADVISOR_RING_SECONDS,
      });
      await this.prisma.callSession.update({
        where: { id: sessionId },
        data: { advisorCallControlId: callControlId },
      });
    } catch (error) {
      this.logger.error(
        `Could not ring advisor for session ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      await this.failSetup(sessionId);
    }

    return { ok: true };
  }

  /** The advisor pressed 1: bridge the two calls. Billing starts after the free period. */
  private async connectCall(sessionId: string, advisorCallControlId: string) {
    const session = await this.prisma.callSession.findUnique({
      where: { id: sessionId },
      select: { status: true, clientCallControlId: true },
    });
    if (!session || session.status !== 'DIALING_ADVISOR' || !session.clientCallControlId) {
      await this.telnyx.hangup(advisorCallControlId);
      return { ok: true };
    }

    const now = new Date();
    const delaySeconds = await this.getBillingDelaySeconds();

    // Claim the transition so a redelivered webhook can't bridge twice.
    const claim = await this.prisma.callSession.updateMany({
      where: { id: sessionId, status: 'DIALING_ADVISOR' },
      data: {
        status: 'CONNECTED',
        connectedAt: now,
        nextBillAt: new Date(now.getTime() + delaySeconds * 1000),
        advisorCallControlId,
      },
    });
    if (claim.count === 0) return { ok: true };

    try {
      await this.telnyx.bridge(session.clientCallControlId, advisorCallControlId);
    } catch (error) {
      this.logger.error(
        `Could not bridge session ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      await this.endSession(sessionId, 'ENDED_NOT_CONNECTED');
      await this.terminateCall(sessionId);
    }

    return { ok: true };
  }

  /**
   * The advisor couldn't be reached or didn't accept. Nobody is charged: end the
   * session, drop the advisor's line, and tell the client before hanging up on them.
   */
  private async failSetup(sessionId: string) {
    const ended = await this.endSession(sessionId, 'ENDED_NOT_CONNECTED');
    if (!ended) return;

    const session = await this.prisma.callSession.findUnique({
      where: { id: sessionId },
      select: { clientCallControlId: true, advisorCallControlId: true },
    });
    if (!session) return;

    await this.telnyx.hangup(session.advisorCallControlId);

    if (session.clientCallControlId) {
      const spoke = await this.telnyx.speak(session.clientCallControlId, CLIENT_UNAVAILABLE_MESSAGE, {
        sessionId,
        leg: 'client',
        step: 'goodbye',
      });
      // If the message couldn't play (the client already left, say), make sure the line is closed.
      if (!spoke) await this.telnyx.hangup(session.clientCallControlId);
    }
  }

  /** Either party hung up (or a leg failed to connect): finish the session and drop the other leg. */
  private async onLegHangup(sessionId: string, leg: CallLeg) {
    const session = await this.prisma.callSession.findUnique({ where: { id: sessionId } });
    if (!session) return { ok: true };

    if (session.status.startsWith('ENDED')) {
      // Already finished. After a setup failure or running out of funds a goodbye may still be
      // playing to the other party; let it finish (it hangs up when done).
      if (session.status !== 'ENDED_NOT_CONNECTED' && session.status !== 'ENDED_LOW_BALANCE') {
        await this.telnyx.hangup(leg === 'client' ? session.advisorCallControlId : session.clientCallControlId);
      }
      return { ok: true };
    }

    // The advisor's line ended before the call was connected (no answer, declined, voicemail):
    // tell the client rather than cutting them off.
    if (leg === 'advisor' && !TALKING_STATUSES.includes(session.status)) {
      await this.failSetup(sessionId);
      return { ok: true };
    }

    await this.endSession(sessionId, TALKING_STATUSES.includes(session.status) ? 'ENDED' : 'ENDED_NOT_CONNECTED');

    // Make sure nobody is left on a dead line.
    await this.telnyx.hangup(leg === 'client' ? session.advisorCallControlId : session.clientCallControlId);
    return { ok: true };
  }

  /** How many free seconds a connected call gets before billing starts. */
  private async getBillingDelaySeconds(): Promise<number> {
    try {
      const setting = await this.prisma.setting.findUnique({ where: { key: TELEPHONY_SETTINGS_KEY } });
      if (setting) {
        const parsed = JSON.parse(setting.value) as { billingDelaySeconds?: unknown };
        const raw = parsed.billingDelaySeconds;
        const seconds = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
        if (Number.isFinite(seconds)) {
          return Math.min(MAX_BILLING_DELAY_SECONDS, Math.max(0, Math.round(seconds)));
        }
      }
    } catch {
      // Fall through to the default.
    }
    return DEFAULT_BILLING_DELAY_SECONDS;
  }

  /** Charges the next minute for every connected call whose billing time has arrived (first charge ends the free period). */
  @Cron('*/5 * * * * *')
  async handleBillingTicks() {
    const due = await this.prisma.callSession.findMany({
      where: { status: { in: TALKING_STATUSES }, nextBillAt: { lte: new Date() } },
      select: { id: true },
    });

    for (const session of due) {
      await this.billNextTick(session.id).catch((error: unknown) => {
        this.logger.error(
          `Billing tick failed for session ${session.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      });
    }

    await this.warnLowBalance().catch((error: unknown) => {
      this.logger.error(
        `Low-balance warning failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    });
  }

  /**
   * About a minute before a charge the client can't cover, tell both parties the call is about to end
   * so it isn't a surprise. Adding funds on the website in that time lets the call continue.
   */
  private async warnLowBalance() {
    const now = new Date();
    const candidates = await this.prisma.callSession.findMany({
      where: {
        status: 'BILLING_ACTIVE',
        lowBalanceWarnedAt: null,
        nextBillAt: { gt: now, lte: new Date(now.getTime() + LOW_BALANCE_WARNING_LEAD_MS) },
      },
      include: { advisor: true, client: true },
    });

    for (const session of candidates) {
      if (session.client.balanceCents >= toCents(session.advisor.ratePerMinute)) continue;

      // Claim the warning so overlapping runs only speak it once.
      const claim = await this.prisma.callSession.updateMany({
        where: { id: session.id, status: 'BILLING_ACTIVE', lowBalanceWarnedAt: null },
        data: { lowBalanceWarnedAt: now },
      });
      if (claim.count === 0) continue;

      if (session.clientCallControlId) {
        // A client with a saved PayPal wallet is offered a top-up right now; everyone else is told where to add funds.
        const offered =
          !session.topUpDeclinedAt &&
          (await this.offerTopUp(session.id, session.client.userId, session.clientCallControlId));
        if (!offered) {
          await this.telnyx.speak(session.clientCallControlId, CLIENT_LOW_BALANCE_WARNING, {
            sessionId: session.id,
            leg: 'client',
          });
        }
      }
      if (session.advisorCallControlId) {
        await this.telnyx.speak(session.advisorCallControlId, ADVISOR_LOW_BALANCE_WARNING, {
          sessionId: session.id,
          leg: 'advisor',
        });
      }
    }
  }

  /** Plays the top-up menu to the client. Returns false if it could not be offered, so the plain warning is used. */
  private async offerTopUp(sessionId: string, userId: string, clientCallControlId: string): Promise<boolean> {
    try {
      if (!(await this.wallets.canOffer(userId))) return false;
      await this.telnyx.promptTopUpMenu(clientCallControlId, TOP_UP_MENU, { sessionId, leg: 'client', step: 'topup' });
      return true;
    } catch (error) {
      this.logger.warn(`Could not offer a top-up on session ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /** The client pressed a key on the top-up menu, or entered an amount. */
  private async onTopUpChoice(state: CallState, callControlId: string, digits: string | undefined) {
    const { sessionId } = state;
    const session = await this.prisma.callSession.findUnique({
      where: { id: sessionId },
      select: { status: true, client: { select: { userId: true } } },
    });
    if (!session || session.status.startsWith('ENDED')) return { ok: true };

    const legState = { sessionId, leg: 'client' as const };
    const say = (text: string) => this.telnyx.speak(callControlId, text, legState);
    const decline = async () => {
      await this.prisma.callSession.updateMany({ where: { id: sessionId }, data: { topUpDeclinedAt: new Date() } });
      await say(TOP_UP_DECLINED);
      return { ok: true };
    };

    let amountCents: number | null = null;
    if (state.step === 'topup') {
      if (digits === '4') {
        await this.telnyx.promptTopUpAmount(callControlId, TOP_UP_AMOUNT_PROMPT, { ...legState, step: 'topup-amount' });
        return { ok: true };
      }
      amountCents = digits ? (TOP_UP_PRESETS[digits] ?? null) : null;
      if (amountCents === null) return decline();
    } else {
      const dollars = Number((digits ?? '').replace(/\D/g, ''));
      if (Number.isInteger(dollars) && dollars >= MIN_TOP_UP_CENTS / 100 && dollars <= MAX_TOP_UP_CENTS / 100) {
        amountCents = dollars * 100;
      } else if (digits && state.step === 'topup-amount') {
        await this.telnyx.promptTopUpAmount(callControlId, TOP_UP_AMOUNT_RETRY, { ...legState, step: 'topup-amount-retry' });
        return { ok: true };
      } else {
        return decline();
      }
    }

    // Answer the webhook now; the charge takes a few seconds and the result is spoken when it is done.
    await say(`Adding ${spokenAmount(amountCents)} to your wallet now.`);
    void this.runTopUp(session.client.userId, sessionId, amountCents, say);
    return { ok: true };
  }

  private async runTopUp(userId: string, sessionId: string, amountCents: number, say: (text: string) => Promise<unknown>) {
    try {
      const result = await this.wallets.topUp(userId, amountCents, sessionId);
      if (result.ok) {
        await say(`Done. ${spokenAmount(result.amountCents)} has been added to your wallet. Your balance is now ${spokenAmount(result.balanceCents)}.`);
      } else if (result.reason === 'limit') {
        await say(
          result.remainingCents && result.remainingCents >= MIN_TOP_UP_CENTS
            ? `That would go over your daily limit. You can add up to ${spokenAmount(result.remainingCents)} today.`
            : 'You have reached your daily limit for adding funds. You can add funds on the website tomorrow.',
        );
      } else if (result.reason === 'declined') {
        await say(TOP_UP_DECLINED_BY_PAYPAL);
      } else {
        await say(TOP_UP_FAILED);
      }
    } catch (error) {
      this.logger.error(`Top-up for session ${sessionId} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      await say(TOP_UP_FAILED).catch(() => undefined);
    }
  }

  @Cron('* * * * *')
  async handleStaleSessions() {
    await this.expireStaleSessions().catch((error: unknown) => {
      this.logger.error(
        `Stale session cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    });
  }

  /** Closes out calls whose webhooks never arrived, so they don't block the client or advisor forever. */
  private async expireStaleSessions() {
    const stale = await this.prisma.callSession.findMany({
      where: {
        status: { in: ['PENDING_CONNECTION', 'AWAITING_CLIENT', 'DIALING_ADVISOR'] },
        startedAt: { lt: new Date(Date.now() - STALE_PENDING_MS) },
      },
      select: { id: true },
    });

    for (const session of stale) {
      await this.endSession(session.id, 'ENDED_NOT_CONNECTED');
      await this.terminateCall(session.id);
    }
  }

  private async billNextTick(sessionId: string) {
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const session = await tx.callSession.findUnique({
        where: { id: sessionId },
        include: { advisor: true, client: true },
      });

      if (
        !session ||
        !TALKING_STATUSES.includes(session.status) ||
        !session.nextBillAt ||
        session.nextBillAt > now
      ) {
        return { terminate: false };
      }

      // Claim this tick atomically: only advance nextBillAt if it still
      // matches what we just read, so an overlapping run can't double-charge.
      // The first tick moves the call out of its free period into billing.
      const claim = await tx.callSession.updateMany({
        where: { id: sessionId, status: session.status, nextBillAt: session.nextBillAt },
        data: {
          status: 'BILLING_ACTIVE',
          nextBillAt: new Date(session.nextBillAt.getTime() + TICK_INTERVAL_MS),
          lowBalanceWarnedAt: null,
        },
      });
      if (claim.count === 0) {
        return { terminate: false };
      }

      const rateCents = toCents(session.advisor.ratePerMinute);

      const debit = await tx.clientProfile.updateMany({
        where: { id: session.clientId, balanceCents: { gte: rateCents } },
        data: { balanceCents: { decrement: rateCents } },
      });

      if (debit.count === 0) {
        return { terminate: true };
      }

      await tx.walletTransaction.create({
        data: {
          userId: session.client.userId,
          callSessionId: sessionId,
          type: 'DEBIT',
          amount: session.advisor.ratePerMinute,
          currency: 'USD',
          minutesDelta: -1,
          description:
            session.status === 'CONNECTED'
              ? `Call session ${sessionId} — billing started, first minute at $${session.advisor.ratePerMinute}/min`
              : `Call session ${sessionId} — per-minute charge`,
        },
      });

      return { terminate: false };
    });

    if (result.terminate) {
      // Out of funds: record the final totals, tell both parties, then drop the call.
      await this.endSession(sessionId, 'ENDED_LOW_BALANCE');
      await this.endCallWithMessage(sessionId);
    }
  }

  /**
   * Tells both parties the call is ending because the balance ran out, then hangs up. Each leg is
   * hung up when its message finishes (call.speak.ended); the timer is a backstop in case that
   * never arrives, and if no message could be played at all the call is dropped right away.
   */
  private async endCallWithMessage(sessionId: string) {
    const session = await this.prisma.callSession.findUnique({
      where: { id: sessionId },
      select: { clientCallControlId: true, advisorCallControlId: true },
    });
    if (!session) return;

    const [clientSpoke, advisorSpoke] = await Promise.all([
      session.clientCallControlId
        ? this.telnyx.speak(session.clientCallControlId, CLIENT_OUT_OF_FUNDS_MESSAGE, {
            sessionId,
            leg: 'client',
            step: 'goodbye',
          })
        : false,
      session.advisorCallControlId
        ? this.telnyx.speak(session.advisorCallControlId, ADVISOR_OUT_OF_FUNDS_MESSAGE, {
            sessionId,
            leg: 'advisor',
            step: 'goodbye',
          })
        : false,
    ]);

    if (!clientSpoke && !advisorSpoke) {
      await this.terminateCall(sessionId);
      return;
    }

    const backstop = setTimeout(() => {
      void this.terminateCall(sessionId);
    }, GOODBYE_BACKSTOP_MS);
    backstop.unref();
  }

  /** Hangs up both legs of a session (the client's and the advisor's). */
  private async terminateCall(sessionId: string) {
    const session = await this.prisma.callSession.findUnique({
      where: { id: sessionId },
      select: { clientCallControlId: true, advisorCallControlId: true },
    });
    if (!session) return;

    if (!session.clientCallControlId && !session.advisorCallControlId) {
      this.logger.warn(`No call legs recorded to hang up for session ${sessionId}`);
      return;
    }

    await Promise.all([
      this.telnyx.hangup(session.clientCallControlId),
      this.telnyx.hangup(session.advisorCallControlId),
    ]);
  }

  private async endSession(sessionId: string, status: string) {
    const session = await this.prisma.callSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.status.startsWith('ENDED')) return null;

    const endedAt = new Date();

    const debitAggregate = await this.prisma.walletTransaction.aggregate({
      _sum: { amount: true },
      _count: { _all: true },
      where: { callSessionId: sessionId, type: 'DEBIT' },
    });

    const billedMinutes = debitAggregate._count._all;
    const billedAmountCents = debitAggregate._sum.amount ? toCents(debitAggregate._sum.amount) : 0;

    // Talk time runs from when the two parties were bridged; a call that never connected has none.
    const durationSeconds = session.connectedAt
      ? Math.max(0, Math.floor((endedAt.getTime() - session.connectedAt.getTime()) / 1000))
      : 0;

    return this.prisma.callSession.update({
      where: { id: sessionId },
      data: {
        endedAt,
        durationSeconds,
        billedMinutes,
        billedAmountCents,
        status,
      },
    });
  }

  async getActiveSession(userId: string) {
    const clientProfile = await this.prisma.clientProfile.findUnique({
      where: { userId },
    });
    if (!clientProfile) return null;

    return this.prisma.callSession.findFirst({
      where: {
        clientId: clientProfile.id,
        status: { in: LIVE_STATUSES },
      },
      select: {
        id: true,
        advisorId: true,
        startedAt: true,
        connectedAt: true,
        nextBillAt: true,
        status: true,
        advisor: { select: { displayName: true, ratePerMinute: true, slug: true } },
        _count: { select: { walletTransactions: { where: { type: 'DEBIT' } } } },
      },
    });
  }
}

export function toCents(value: unknown): number {
  return Math.round(Number(value) * 100);
}

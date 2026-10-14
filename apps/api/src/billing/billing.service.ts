import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CallLeg, TelnyxService, decodeState } from '../telephony/telnyx.service';
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
const CLIENT_PROMPT = 'Welcome to The Psychic Link. To begin your call, press 1 now.';
const ADVISOR_PROMPT = 'You have a call from The Psychic Link. Press 1 to accept this call.';
const CLIENT_UNAVAILABLE_MESSAGE =
  'We are sorry, your advisor is unavailable right now. You have not been charged. Goodbye.';
const CLIENT_LOW_BALANCE_WARNING =
  'Your balance is running low. This call will end in about one minute unless you add funds to your wallet on the website.';
const ADVISOR_LOW_BALANCE_WARNING = "The client's balance is running low. This call will end in about one minute.";
const CLIENT_OUT_OF_FUNDS_MESSAGE = 'Your balance has run out, so this call is ending. Goodbye.';
const ADVISOR_OUT_OF_FUNDS_MESSAGE = "The client's balance has run out, so this call is ending. Goodbye.";

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
    payload?: {
      call_control_id?: string;
      client_state?: string;
      hangup_cause?: string;
      hangup_source?: string;
      sip_hangup_cause?: string;
      digits?: string;
      status?: string;
    };
  };
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telnyx: TelnyxService,
  ) {}

  /** Checks the balance and availability, then rings the client to begin the call. */
  async startSession(userId: string, dto: StartSessionDto) {
    const client = await this.prisma.clientProfile.findUnique({ where: { userId } });
    if (!client) throw new NotFoundException('Client profile not found');
    if (!client.phoneNumber) {
      throw new BadRequestException('Add your phone number so we know where to call you.');
    }

    const advisor = await this.prisma.advisorProfile.findUnique({ where: { id: dto.advisorId } });
    if (!advisor) throw new NotFoundException('Advisor not found');
    if (!advisor.isOnline) throw new BadRequestException('This advisor is not taking calls right now.');
    if (!advisor.phoneNumber) throw new BadRequestException('This advisor is not set up for phone calls yet.');

    const rateCents = toCents(advisor.ratePerMinute);
    if (rateCents <= 0) throw new BadRequestException('This advisor has not set a rate yet.');

    const requiredCents = rateCents * MIN_CALL_MINUTES;
    if (client.balanceCents < requiredCents) {
      throw new BadRequestException(
        `You need at least $${(requiredCents / 100).toFixed(2)} (${MIN_CALL_MINUTES} minutes) in your wallet to call this advisor.`,
      );
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

    const session = await this.prisma.callSession.create({
      data: { advisorId: advisor.id, clientId: client.id, status: 'PENDING_CONNECTION' },
    });

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

  async stopSession(sessionId: string, userId: string) {
    const session = await this.prisma.callSession.findUnique({
      where: { id: sessionId },
      include: { client: true },
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

    // Not a call this app placed (or an event we don't act on): acknowledge so Telnyx doesn't retry.
    if (!state || !callControlId) return { ok: true };

    // Why a leg ended or what a party pressed is the first thing to look at when a call misbehaves.
    if (eventType === 'call.hangup') {
      this.logger.log(
        `${eventType} session=${state.sessionId} leg=${state.leg} cause=${payload.hangup_cause ?? '?'} sip=${payload.sip_hangup_cause ?? '?'} source=${payload.hangup_source ?? '?'}`,
      );
    } else if (eventType === 'call.gather.ended') {
      this.logger.log(
        `${eventType} session=${state.sessionId} leg=${state.leg} digits=${payload.digits ?? ''} status=${payload.status ?? '?'}`,
      );
    } else if (eventType === 'call.answered' || eventType === 'call.speak.ended') {
      this.logger.log(`${eventType} session=${state.sessionId} leg=${state.leg}`);
    }

    switch (eventType) {
      case 'call.answered':
        return state.leg === 'client'
          ? this.onClientAnswered(state.sessionId, callControlId)
          : this.onAdvisorAnswered(state.sessionId, callControlId);

      case 'call.gather.ended':
        return this.onGatherEnded(state.sessionId, state.leg, callControlId, payload.digits);

      case 'call.speak.ended':
        // A goodbye has finished playing: now hang up.
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
    const session = await this.prisma.callSession.findUnique({ where: { id: sessionId }, select: { status: true } });
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
      await this.telnyx.promptToPressOne(clientCallControlId, CLIENT_PROMPT, {
        sessionId,
        leg: 'client',
        step: 'consent',
      });
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
    const session = await this.prisma.callSession.findUnique({ where: { id: sessionId }, select: { status: true } });
    if (!session || session.status !== 'DIALING_ADVISOR') {
      await this.telnyx.hangup(advisorCallControlId);
      return { ok: true };
    }

    try {
      await this.telnyx.promptToPressOne(advisorCallControlId, ADVISOR_PROMPT, {
        sessionId,
        leg: 'advisor',
        step: 'consent',
      });
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
        await this.telnyx.speak(session.clientCallControlId, CLIENT_LOW_BALANCE_WARNING, {
          sessionId: session.id,
          leg: 'client',
        });
      }
      if (session.advisorCallControlId) {
        await this.telnyx.speak(session.advisorCallControlId, ADVISOR_LOW_BALANCE_WARNING, {
          sessionId: session.id,
          leg: 'advisor',
        });
      }
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
        advisor: { select: { displayName: true, ratePerMinute: true } },
        _count: { select: { walletTransactions: { where: { type: 'DEBIT' } } } },
      },
    });
  }
}

export function toCents(value: unknown): number {
  return Math.round(Number(value) * 100);
}

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
import { TelnyxService, decodeState } from '../telephony/telnyx.service';
import { StartSessionDto } from './billing.dto';

/** How often a connected call is charged another minute. */
const TICK_INTERVAL_MS = 60_000;

/** A client needs at least this many minutes of the advisor's rate to start a call. */
export const MIN_CALL_MINUTES = 2;

const CLIENT_RING_SECONDS = 40;
const ADVISOR_RING_SECONDS = 30;

/** A call that hasn't connected after this long is treated as dead and cleaned up. */
const STALE_PENDING_MS = 3 * 60_000;

/** Statuses of a call that is still being set up or in progress. */
export const LIVE_STATUSES = ['PENDING_CONNECTION', 'DIALING_ADVISOR', 'BILLING_ACTIVE'];

export interface TelnyxWebhookBody {
  data?: {
    event_type?: string;
    payload?: {
      call_control_id?: string;
      client_state?: string;
      hangup_cause?: string;
      hangup_source?: string;
      sip_hangup_cause?: string;
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

  /** Checks the balance and availability, then rings the client to begin the bridge. */
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

    // Why a leg ended is the first thing to look at when a call drops.
    if (eventType === 'call.answered' || eventType === 'call.hangup') {
      const detail =
        eventType === 'call.hangup'
          ? ` cause=${payload.hangup_cause ?? '?'} sip=${payload.sip_hangup_cause ?? '?'} source=${payload.hangup_source ?? '?'}`
          : '';
      this.logger.log(`${eventType} session=${state.sessionId} leg=${state.leg}${detail}`);
    }

    if (eventType === 'call.answered') {
      return state.leg === 'client'
        ? this.onClientAnswered(state.sessionId, callControlId)
        : this.onAdvisorAnswered(state.sessionId, callControlId);
    }

    if (eventType === 'call.hangup') {
      return this.onLegHangup(state.sessionId, state.leg);
    }

    return { ok: true };
  }

  /** Client picked up: now ring the advisor's extension and bridge the two on answer. */
  private async onClientAnswered(sessionId: string, clientCallControlId: string) {
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
      where: { id: sessionId, status: 'PENDING_CONNECTION' },
      data: { status: 'DIALING_ADVISOR', clientCallControlId },
    });
    if (claim.count === 0) return { ok: true };

    try {
      if (!session.advisor.phoneNumber) throw new Error('Advisor has no phone number on file');
      const { callControlId } = await this.telnyx.dial({
        to: session.advisor.phoneNumber,
        state: { sessionId, leg: 'advisor' },
        timeoutSecs: ADVISOR_RING_SECONDS,
        linkTo: clientCallControlId,
      });
      await this.prisma.callSession.update({
        where: { id: sessionId },
        data: { advisorCallControlId: callControlId },
      });
    } catch (error) {
      this.logger.error(
        `Could not ring advisor for session ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      await this.endSession(sessionId, 'ENDED_NOT_CONNECTED');
      await this.telnyx.hangup(clientCallControlId);
    }

    return { ok: true };
  }

  /** Advisor picked up and Telnyx has bridged the call: this is when billing starts. */
  private async onAdvisorAnswered(sessionId: string, advisorCallControlId: string) {
    const status = await this.startBillingForConnectedCall(sessionId, advisorCallControlId);
    return { ok: true, status };
  }

  /** Either party hung up (or a leg failed to connect): finish the session and drop the other leg. */
  private async onLegHangup(sessionId: string, leg: 'client' | 'advisor') {
    const session = await this.prisma.callSession.findUnique({ where: { id: sessionId } });
    if (!session) return { ok: true };

    if (!session.status.startsWith('ENDED')) {
      await this.endSession(sessionId, session.status === 'BILLING_ACTIVE' ? 'ENDED' : 'ENDED_NOT_CONNECTED');
    }

    // Make sure nobody is left on a dead line.
    await this.telnyx.hangup(leg === 'client' ? session.advisorCallControlId : session.clientCallControlId);
    return { ok: true };
  }

  private async startBillingForConnectedCall(sessionId: string, advisorCallControlId: string) {
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const session = await tx.callSession.findUnique({
        where: { id: sessionId },
        include: { advisor: true, client: true },
      });
      if (!session) {
        throw new NotFoundException(`Session ${sessionId} not found`);
      }

      if (session.status === 'BILLING_ACTIVE') {
        return { status: 'BILLING_ACTIVE' };
      }

      if (session.status.startsWith('ENDED')) {
        return { status: session.status };
      }

      const existingDebit = await tx.walletTransaction.findFirst({
        where: {
          callSessionId: sessionId,
          type: 'DEBIT',
          minutesDelta: -1,
        },
        select: { id: true },
      });

      if (existingDebit) {
        await tx.callSession.update({
          where: { id: sessionId },
          data: { status: 'BILLING_ACTIVE', advisorCallControlId },
        });
        return { status: 'BILLING_ACTIVE' };
      }

      const rateCents = toCents(session.advisor.ratePerMinute);

      const debitResult = await tx.clientProfile.updateMany({
        where: { id: session.clientId, balanceCents: { gte: rateCents } },
        data: { balanceCents: { decrement: rateCents } },
      });

      if (debitResult.count === 0) {
        await tx.callSession.update({
          where: { id: sessionId },
          data: { status: 'ENDED_LOW_BALANCE', endedAt: now, durationSeconds: 0, advisorCallControlId },
        });
        return { status: 'ENDED_LOW_BALANCE' };
      }

      await tx.walletTransaction.create({
        data: {
          userId: session.client.userId,
          callSessionId: sessionId,
          type: 'DEBIT',
          amount: session.advisor.ratePerMinute,
          currency: 'USD',
          minutesDelta: -1,
          description: `Call session ${sessionId} connected — first minute at $${session.advisor.ratePerMinute}/min`,
        },
      });

      await tx.callSession.update({
        where: { id: sessionId },
        data: {
          startedAt: now,
          status: 'BILLING_ACTIVE',
          advisorCallControlId,
          nextBillAt: new Date(now.getTime() + TICK_INTERVAL_MS),
        },
      });

      return { status: 'BILLING_ACTIVE' };
    });

    if (result.status === 'ENDED_LOW_BALANCE') {
      await this.terminateCall(sessionId);
    }

    return result.status;
  }

  /** Charges one more minute for every connected call whose next-bill time has arrived. */
  @Cron('* * * * *')
  async handlePerMinuteBilling() {
    await this.expireStaleSessions().catch((error: unknown) => {
      this.logger.error(
        `Stale session cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    });

    const due = await this.prisma.callSession.findMany({
      where: { status: 'BILLING_ACTIVE', nextBillAt: { lte: new Date() } },
      select: { id: true },
    });

    for (const session of due) {
      await this.billNextTick(session.id).catch((error: unknown) => {
        this.logger.error(
          `Per-minute billing tick failed for session ${session.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      });
    }
  }

  /** Closes out calls whose webhooks never arrived, so they don't block the client or advisor forever. */
  private async expireStaleSessions() {
    const stale = await this.prisma.callSession.findMany({
      where: {
        status: { in: ['PENDING_CONNECTION', 'DIALING_ADVISOR'] },
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

      if (!session || session.status !== 'BILLING_ACTIVE' || !session.nextBillAt || session.nextBillAt > now) {
        return { terminate: false };
      }

      // Claim this tick atomically: only advance nextBillAt if it still
      // matches what we just read, so an overlapping run can't double-charge.
      const claim = await tx.callSession.updateMany({
        where: { id: sessionId, status: 'BILLING_ACTIVE', nextBillAt: session.nextBillAt },
        data: { nextBillAt: new Date(session.nextBillAt.getTime() + TICK_INTERVAL_MS) },
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
          description: `Call session ${sessionId} — per-minute charge`,
        },
      });

      return { terminate: false };
    });

    if (result.terminate) {
      // Out of funds: record the final totals, then drop the call.
      await this.endSession(sessionId, 'ENDED_LOW_BALANCE');
      await this.terminateCall(sessionId);
    }
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

    // startedAt is reset to the moment billing begins, so a call that never
    // connected (and was never billed) has no talk time.
    const durationSeconds =
      billedMinutes > 0
        ? Math.max(0, Math.floor((endedAt.getTime() - session.startedAt.getTime()) / 1000))
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
        status: true,
        advisor: { select: { displayName: true, ratePerMinute: true } },
      },
    });
  }
}

export function toCents(value: unknown): number {
  return Math.round(Number(value) * 100);
}

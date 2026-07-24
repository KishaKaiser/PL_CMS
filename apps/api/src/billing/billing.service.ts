import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { StartSessionDto } from './billing.dto';
import { createHmac, timingSafeEqual } from 'crypto';

/** How often a connected call is charged another minute. */
const TICK_INTERVAL_MS = 60_000;

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async startSession(userId: string, dto: StartSessionDto) {
    const clientProfile = await this.prisma.clientProfile.findUnique({
      where: { userId },
    });
    if (!clientProfile) throw new NotFoundException('Client profile not found');

    const advisorProfile = await this.prisma.advisorProfile.findUnique({
      where: { id: dto.advisorId },
    });
    if (!advisorProfile) throw new NotFoundException('Advisor not found');

    const session = await this.prisma.callSession.create({
      data: {
        advisorId: dto.advisorId,
        clientId: clientProfile.id,
        status: 'PENDING_CONNECTION',
      },
    });

    return session;
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
    await this.terminateTwilioCall(sessionId, session.twilioCallSid ?? undefined);

    return {
      sessionId,
      status: 'ENDED_BY_USER',
      durationSeconds: ended?.durationSeconds ?? 0,
      billedMinutes: ended?.billedMinutes ?? 0,
      billedAmountCents: ended?.billedAmountCents ?? 0,
    };
  }

  async handleTwilioStatusCallback(
    headers: Record<string, string>,
    rawBody: string,
    callbackUrl: string,
    sessionId: string,
    payload: Record<string, string>,
  ) {
    if (!sessionId) {
      throw new BadRequestException('Missing sessionId query parameter');
    }

    this.verifyTwilioSignature(headers, callbackUrl, payload);

    const callStatus = (payload.CallStatus ?? payload.CallEvent ?? '').toLowerCase();
    const callSid = payload.CallSid;

    const session = await this.prisma.callSession.findUnique({
      where: { id: sessionId },
      include: { client: { include: { user: true } } },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    if (['in-progress', 'answered'].includes(callStatus)) {
      return this.startBillingForConnectedCall(
        sessionId,
        session.client.id,
        session.client.userId,
        callSid,
      );
    }

    if (['completed', 'canceled', 'busy', 'failed', 'no-answer'].includes(callStatus)) {
      await this.endSession(sessionId, 'ENDED');
      return { ok: true, status: 'ENDED' };
    }

    this.logger.log(
      `Unhandled Twilio status callback for session ${sessionId}: status=${callStatus}, callSid=${callSid}, rawLength=${rawBody.length}`,
    );
    return { ok: true, status: session.status };
  }

  private verifyTwilioSignature(
    headers: Record<string, string>,
    callbackUrl: string,
    params: Record<string, string>,
  ) {
    const twilioAuthToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    if (!twilioAuthToken) {
      throw new UnauthorizedException('TWILIO_AUTH_TOKEN is not configured');
    }

    const twilioSignature = headers['x-twilio-signature'] ?? headers['X-Twilio-Signature'];
    if (!twilioSignature) {
      throw new UnauthorizedException('Missing X-Twilio-Signature header');
    }

    const sortedKeys = Object.keys(params).sort();
    const data = sortedKeys.reduce((acc, key) => `${acc}${key}${params[key] ?? ''}`, callbackUrl);
    const expected = createHmac('sha1', twilioAuthToken).update(data).digest('base64');

    const providedBuffer = Buffer.from(twilioSignature);
    const expectedBuffer = Buffer.from(expected);

    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Invalid Twilio callback signature');
    }
  }

  private async startBillingForConnectedCall(
    sessionId: string,
    clientProfileId: string,
    userId: string,
    callSid?: string,
  ) {
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const session = await tx.callSession.findUnique({
        where: { id: sessionId },
        include: { advisor: true },
      });
      if (!session) {
        throw new NotFoundException(`Session ${sessionId} not found`);
      }

      if (session.status === 'BILLING_ACTIVE') {
        return { status: 'BILLING_ACTIVE', debited: true };
      }

      if (session.status.startsWith('ENDED')) {
        return { status: session.status, debited: false };
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
          data: { status: 'BILLING_ACTIVE', twilioCallSid: callSid ?? session.twilioCallSid },
        });
        return { status: 'BILLING_ACTIVE', debited: true };
      }

      const rateCents = toCents(session.advisor.ratePerMinute);

      const debitResult = await tx.clientProfile.updateMany({
        where: { id: clientProfileId, balanceCents: { gte: rateCents } },
        data: { balanceCents: { decrement: rateCents } },
      });

      if (debitResult.count === 0) {
        await tx.callSession.update({
          where: { id: sessionId },
          data: { status: 'ENDED_LOW_BALANCE', endedAt: now, twilioCallSid: callSid ?? session.twilioCallSid },
        });
        return { status: 'ENDED_LOW_BALANCE', debited: false };
      }

      await tx.walletTransaction.create({
        data: {
          userId,
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
          twilioCallSid: callSid ?? session.twilioCallSid,
          nextBillAt: new Date(now.getTime() + TICK_INTERVAL_MS),
        },
      });

      return { status: 'BILLING_ACTIVE', debited: true };
    });

    if (result.status === 'ENDED_LOW_BALANCE') {
      await this.terminateTwilioCall(sessionId, callSid);
    }

    return { ok: true, status: result.status };
  }

  /** Charges one more minute for every connected call whose next-bill time has arrived. */
  @Cron('* * * * *')
  async handlePerMinuteBilling() {
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
        await tx.callSession.update({
          where: { id: sessionId },
          data: { status: 'ENDED_LOW_BALANCE', endedAt: now },
        });
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
      const session = await this.prisma.callSession.findUnique({
        where: { id: sessionId },
        select: { twilioCallSid: true },
      });
      await this.terminateTwilioCall(sessionId, session?.twilioCallSid ?? undefined);
    }
  }

  private async terminateTwilioCall(sessionId: string, callSid?: string) {
    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');

    if (!accountSid || !authToken || !callSid) {
      this.logger.warn(`Unable to terminate Twilio call for session ${sessionId}: missing credentials or call SID`);
      return;
    }

    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'Status=completed',
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Failed to terminate Twilio call for session ${sessionId}: ${response.status} ${body}`);
    }
  }

  private async endSession(sessionId: string, status: string) {
    const session = await this.prisma.callSession.findUnique({
      where: { id: sessionId },
      include: { client: true },
    });

    if (!session || session.status.startsWith('ENDED')) return null;

    const endedAt = new Date();
    const durationSeconds = Math.max(
      0,
      Math.floor((endedAt.getTime() - session.startedAt.getTime()) / 1000),
    );

    const debitAggregate = await this.prisma.walletTransaction.aggregate({
      _sum: { amount: true },
      _count: { _all: true },
      where: { callSessionId: sessionId, type: 'DEBIT' },
    });

    const billedMinutes = debitAggregate._count._all;
    const billedAmountCents = debitAggregate._sum.amount ? toCents(debitAggregate._sum.amount) : 0;

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
        status: { in: ['PENDING_CONNECTION', 'BILLING_ACTIVE'] },
      },
      include: { advisor: true },
    });
  }
}

function toCents(value: unknown): number {
  return Math.round(Number(value) * 100);
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StartSessionDto } from './billing.dto';
import { createHmac, timingSafeEqual } from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';

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

    await this.endSession(sessionId, 'ENDED_BY_USER');

    return {
      sessionId,
      status: 'ENDED_BY_USER',
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
      const session = await tx.callSession.findUnique({ where: { id: sessionId } });
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
          data: { status: 'BILLING_ACTIVE' },
        });
        return { status: 'BILLING_ACTIVE', debited: true };
      }

      const debitResult = await tx.clientProfile.updateMany({
        where: { id: clientProfileId, balanceMinutes: { gte: 1 } },
        data: { balanceMinutes: { decrement: 1 } },
      });

      if (debitResult.count === 0) {
        await tx.callSession.update({
          where: { id: sessionId },
          data: { status: 'ENDED_LOW_BALANCE', endedAt: now },
        });
        return { status: 'ENDED_LOW_BALANCE', debited: false };
      }

      await tx.walletTransaction.create({
        data: {
          userId,
          callSessionId: sessionId,
          type: 'DEBIT',
          amount: new Decimal(1),
          currency: 'MIN',
          minutesDelta: -1,
          description: `Call session ${sessionId} connected - initial minute debit`,
        },
      });

      await tx.callSession.update({
        where: { id: sessionId },
        data: { startedAt: now, status: 'BILLING_ACTIVE' },
      });

      return { status: 'BILLING_ACTIVE', debited: true };
    });

    if (result.status === 'ENDED_LOW_BALANCE') {
      await this.terminateTwilioCall(sessionId, callSid);
    }

    return { ok: true, status: result.status };
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

    if (!session || session.status.startsWith('ENDED')) return;

    const endedAt = new Date();
    const durationSeconds = Math.max(
      0,
      Math.floor((endedAt.getTime() - session.startedAt.getTime()) / 1000),
    );

    const debitAggregate = await this.prisma.walletTransaction.aggregate({
      _sum: { amount: true },
      where: { callSessionId: sessionId, type: 'DEBIT', currency: 'MIN' },
    });

    const billedMinutes = debitAggregate._sum.amount
      ? Number(debitAggregate._sum.amount)
      : 0;

    await this.prisma.callSession.update({
      where: { id: sessionId },
      data: {
        endedAt,
        durationSeconds,
        billedMinutes,
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

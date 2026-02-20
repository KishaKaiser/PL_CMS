import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StartSessionDto } from './billing.dto';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async startSession(userId: string, dto: StartSessionDto) {
    const clientProfile = await this.prisma.clientProfile.findUnique({
      where: { userId },
    });
    if (!clientProfile) throw new NotFoundException('Client profile not found');
    if (clientProfile.balanceMinutes < 1) {
      throw new BadRequestException('Insufficient minute balance');
    }

    const advisorProfile = await this.prisma.advisorProfile.findUnique({
      where: { id: dto.advisorId },
    });
    if (!advisorProfile) throw new NotFoundException('Advisor not found');

    const session = await this.prisma.callSession.create({
      data: {
        advisorId: dto.advisorId,
        clientId: clientProfile.id,
        status: 'ACTIVE',
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
    if (session.status !== 'ACTIVE') {
      throw new BadRequestException('Session is not active');
    }

    const endedAt = new Date();
    const durationSeconds = Math.floor(
      (endedAt.getTime() - session.startedAt.getTime()) / 1000,
    );
    const billedMinutes = Math.max(1, Math.ceil(durationSeconds / 60));

    // Debit client balance
    const clientProfile = await this.prisma.clientProfile.findUnique({
      where: { id: session.clientId },
    });
    if (!clientProfile) throw new NotFoundException('Client profile not found');

    const actualDebit = Math.min(billedMinutes, clientProfile.balanceMinutes);

    await this.prisma.$transaction([
      this.prisma.callSession.update({
        where: { id: sessionId },
        data: { endedAt, durationSeconds, billedMinutes: actualDebit, status: 'ENDED' },
      }),
      this.prisma.clientProfile.update({
        where: { id: session.clientId },
        data: { balanceMinutes: { decrement: actualDebit } },
      }),
      this.prisma.walletTransaction.create({
        data: {
          userId,
          type: 'DEBIT',
          amount: actualDebit,
          currency: 'MIN',
          description: `Call session ${sessionId} – ${actualDebit} min`,
        },
      }),
    ]);

    return {
      sessionId,
      durationSeconds,
      billedMinutes: actualDebit,
      status: 'ENDED',
    };
  }

  async getActiveSession(userId: string) {
    const clientProfile = await this.prisma.clientProfile.findUnique({
      where: { userId },
    });
    if (!clientProfile) return null;

    return this.prisma.callSession.findFirst({
      where: { clientId: clientProfile.id, status: 'ACTIVE' },
      include: { advisor: true },
    });
  }
}

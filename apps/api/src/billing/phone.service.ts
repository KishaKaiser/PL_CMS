import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LIVE_STATUSES } from './billing.service';

@Injectable()
export class PhoneService {
  constructor(private readonly prisma: PrismaService) {}

  /** Advisors a client can call right now. Never exposes the internal SIP extension. */
  async listOnlineAdvisors() {
    const advisors = await this.prisma.advisorProfile.findMany({
      where: {
        isOnline: true,
        sipExtension: { not: null },
        ratePerMinute: { gt: 0 },
      },
      select: {
        id: true,
        displayName: true,
        bio: true,
        profileImageUrl: true,
        ratePerMinute: true,
      },
      orderBy: { displayName: 'asc' },
      take: 100,
    });

    const onCall = await this.prisma.callSession.findMany({
      where: { status: { in: LIVE_STATUSES }, advisorId: { in: advisors.map((advisor) => advisor.id) } },
      select: { advisorId: true },
    });
    const busyIds = new Set(onCall.map((session) => session.advisorId));

    return advisors.map((advisor) => ({ ...advisor, busy: busyIds.has(advisor.id) }));
  }

  async getMyPhoneProfile(userId: string) {
    const client = await this.prisma.clientProfile.findUnique({
      where: { userId },
      select: { phoneNumber: true, balanceCents: true },
    });
    if (!client) throw new NotFoundException('Client profile not found');
    return client;
  }

  async setMyPhoneNumber(userId: string, input: string) {
    const phoneNumber = normalizePhoneNumber(input);
    if (!phoneNumber) {
      throw new BadRequestException('Enter a valid phone number, including area code.');
    }

    const client = await this.prisma.clientProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!client) throw new NotFoundException('Client profile not found');

    return this.prisma.clientProfile.update({
      where: { id: client.id },
      data: { phoneNumber },
      select: { phoneNumber: true, balanceCents: true },
    });
  }
}

/** Turns "(555) 123-4567" or "+44 20 7946 0958" into E.164, or null if it can't be one. */
export function normalizePhoneNumber(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');

  if (trimmed.startsWith('+')) {
    return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

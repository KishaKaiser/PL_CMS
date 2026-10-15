import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePhoneNumber } from '../telephony/phone-number';
import { LIVE_STATUSES } from './billing.service';

@Injectable()
export class PhoneService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every advisor a client can call or book: anyone with a phone number and a rate. Online advisors come first
   * (available ones before those on a call), then offline advisors, who can still be scheduled.
   * Never exposes an advisor's phone number.
   */
  async listAdvisors() {
    const advisors = await this.prisma.advisorProfile.findMany({
      where: {
        phoneNumber: { not: null },
        ratePerMinute: { gt: 0 },
      },
      select: {
        id: true,
        displayName: true,
        bio: true,
        profileImageUrl: true,
        ratePerMinute: true,
        isOnline: true,
      },
      orderBy: { displayName: 'asc' },
      take: 100,
    });

    const onCall = await this.prisma.callSession.findMany({
      where: { status: { in: LIVE_STATUSES }, advisorId: { in: advisors.map((advisor) => advisor.id) } },
      select: { advisorId: true },
    });
    const busyIds = new Set(onCall.map((session) => session.advisorId));

    // Array.prototype.sort is stable, so advisors keep their alphabetical order within each group.
    const rank = (advisor: { isOnline: boolean; busy: boolean }) => (!advisor.isOnline ? 2 : advisor.busy ? 1 : 0);
    return advisors
      .map((advisor) => ({ ...advisor, busy: advisor.isOnline && busyIds.has(advisor.id) }))
      .sort((a, b) => rank(a) - rank(b));
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

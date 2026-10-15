import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePhoneNumber } from '../telephony/phone-number';
import { ensureAdvisorSlug, publicReviewerName } from './advisor-slug';
import { SubmitReviewDto } from './billing.dto';
import { LIVE_STATUSES } from './billing.service';

const MAX_PUBLIC_REVIEWS = 50;

@Injectable()
export class PhoneService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The advisors on the readings page: those switched online right now, available ones before those on a call.
   * Offline advisors are not listed; they are reached through their own public profile page.
   * Never exposes an advisor's phone number.
   */
  async listAdvisors() {
    const advisors = await this.prisma.advisorProfile.findMany({
      where: {
        isOnline: true,
        phoneNumber: { not: null },
        ratePerMinute: { gt: 0 },
      },
      select: {
        id: true,
        slug: true,
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

    const cards = await Promise.all(
      advisors.map(async (advisor) => ({
        ...advisor,
        slug: await ensureAdvisorSlug(this.prisma, advisor),
        busy: busyIds.has(advisor.id),
      })),
    );

    // Array.prototype.sort is stable, so advisors keep their alphabetical order within each group.
    return cards.sort((a, b) => Number(a.busy) - Number(b.busy));
  }

  /**
   * An advisor's public profile page: who they are, their usual hours, and what clients say about them.
   * Works whether or not the advisor is online. Never exposes the advisor's phone number.
   */
  async getPublicProfile(slugOrId: string) {
    const advisor = await this.findPublicAdvisor(slugOrId);
    const slug = await ensureAdvisorSlug(this.prisma, advisor);

    const [slots, liveSession, ratings, reviews] = await Promise.all([
      this.prisma.availabilitySchedule.findMany({
        where: { advisorId: advisor.id },
        select: { dayOfWeek: true, startTime: true, endTime: true, timezone: true },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      }),
      this.prisma.callSession.findFirst({
        where: { advisorId: advisor.id, status: { in: LIVE_STATUSES } },
        select: { id: true },
      }),
      this.prisma.advisorReview.aggregate({
        where: { advisorId: advisor.id },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.advisorReview.findMany({
        where: { advisorId: advisor.id },
        select: { id: true, rating: true, comment: true, createdAt: true, user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: MAX_PUBLIC_REVIEWS,
      }),
    ]);

    const average = ratings._avg.rating;
    return {
      id: advisor.id,
      slug,
      displayName: advisor.displayName,
      bio: advisor.bio,
      profileImageUrl: advisor.profileImageUrl,
      ratePerMinute: advisor.ratePerMinute,
      isOnline: advisor.isOnline,
      busy: advisor.isOnline && liveSession !== null,
      schedule: {
        timezone: slots[0]?.timezone ?? null,
        slots: slots.map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime })),
      },
      rating: {
        average: average === null ? null : Math.round(average * 10) / 10,
        count: ratings._count._all,
      },
      reviews: reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        reviewerName: publicReviewerName(review.user.name),
      })),
    };
  }

  /** Whether the signed-in client may review this advisor, and what they wrote before if so. */
  async getMyReview(userId: string, slugOrId: string) {
    const advisor = await this.findPublicAdvisor(slugOrId);
    const eligible = await this.hasSpokenWith(userId, advisor.id);
    const review = await this.prisma.advisorReview.findUnique({
      where: { advisorId_userId: { advisorId: advisor.id, userId } },
      select: { rating: true, comment: true },
    });
    return { eligible, review };
  }

  /** Saves the client's star rating and comment. Only clients who have actually spoken with the advisor can. */
  async submitReview(userId: string, slugOrId: string, dto: SubmitReviewDto) {
    const advisor = await this.findPublicAdvisor(slugOrId);
    if (advisor.userId === userId) throw new ForbiddenException('You cannot review yourself.');
    if (!(await this.hasSpokenWith(userId, advisor.id))) {
      throw new ForbiddenException('You can review an advisor after you have spoken with them.');
    }

    const comment = dto.comment?.trim() || null;
    const review = await this.prisma.advisorReview.upsert({
      where: { advisorId_userId: { advisorId: advisor.id, userId } },
      create: { advisorId: advisor.id, userId, rating: dto.rating, comment },
      update: { rating: dto.rating, comment },
      select: { rating: true, comment: true },
    });
    return review;
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

  /** An advisor with a public page: set up to take calls (phone number and rate), found by slug or id. */
  private async findPublicAdvisor(slugOrId: string) {
    const advisor = await this.prisma.advisorProfile.findFirst({
      where: {
        OR: [{ slug: slugOrId }, { id: slugOrId }],
        phoneNumber: { not: null },
        ratePerMinute: { gt: 0 },
      },
      select: {
        id: true,
        userId: true,
        slug: true,
        displayName: true,
        bio: true,
        profileImageUrl: true,
        ratePerMinute: true,
        isOnline: true,
      },
    });
    if (!advisor) throw new NotFoundException('Advisor not found');
    return advisor;
  }

  private async hasSpokenWith(userId: string, advisorId: string): Promise<boolean> {
    const client = await this.prisma.clientProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!client) return false;
    const session = await this.prisma.callSession.findFirst({
      where: { clientId: client.id, advisorId, connectedAt: { not: null } },
      select: { id: true },
    });
    return session !== null;
  }
}

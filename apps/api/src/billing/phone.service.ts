import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePhoneNumber } from '../telephony/phone-number';
import { publicName } from '../common/public-identity';
import { ensureAdvisorSlug } from './advisor-slug';
import { SubmitReviewDto } from './billing.dto';
import { LIVE_STATUSES } from './billing.service';

const MAX_PUBLIC_REVIEWS = 50;

/** How many advisors one client can keep in their favourites. */
export const MAX_FAVORITES = 50;

@Injectable()
export class PhoneService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

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
        queueCallingEnabled: true,
      },
      orderBy: { displayName: 'asc' },
      take: 100,
    });

    const onCall = await this.prisma.callSession.findMany({
      where: { status: { in: LIVE_STATUSES }, advisorId: { in: advisors.map((advisor) => advisor.id) } },
      select: { advisorId: true },
    });
    const busyIds = new Set(onCall.map((session) => session.advisorId));
    const queueLengths = await this.queueLengths(advisors.map((advisor) => advisor.id));

    const cards = await Promise.all(
      advisors.map(async ({ queueCallingEnabled, ...advisor }) => {
        const queueLength = queueLengths.get(advisor.id) ?? 0;
        return {
          ...advisor,
          slug: await ensureAdvisorSlug(this.prisma, advisor),
          // Busy while on a call, or while clients already in line are waiting for their turn.
          busy: busyIds.has(advisor.id) || queueLength > 0,
          queueEnabled: queueCallingEnabled,
          queueLength,
        };
      }),
    );

    // Array.prototype.sort is stable, so advisors keep their alphabetical order within each group.
    return cards.sort((a, b) => Number(a.busy) - Number(b.busy));
  }

  /**
   * The signed-in client's favourite advisors, newest first within each group: available now, then on a call, then
   * offline. Offline favourites are included, which is the point: this is how a client gets back to them.
   */
  async listFavorites(userId: string) {
    const rows = await this.prisma.favoriteAdvisor.findMany({
      where: { userId, advisor: { phoneNumber: { not: null }, ratePerMinute: { gt: 0 } } },
      orderBy: { createdAt: 'desc' },
      take: MAX_FAVORITES,
      select: {
        advisor: {
          select: { id: true, slug: true, displayName: true, profileImageUrl: true, ratePerMinute: true, isOnline: true },
        },
      },
    });
    const advisors = rows.map((row) => row.advisor);
    const ids = advisors.map((advisor) => advisor.id);

    const onCall = await this.prisma.callSession.findMany({
      where: { status: { in: LIVE_STATUSES }, advisorId: { in: ids } },
      select: { advisorId: true },
    });
    const busyIds = new Set(onCall.map((session) => session.advisorId));
    const queueLengths = await this.queueLengths(ids);

    const cards = await Promise.all(
      advisors.map(async (advisor) => {
        const queueLength = queueLengths.get(advisor.id) ?? 0;
        // Named fields only, so nothing else about the advisor (their phone number above all) can slip into the card.
        return {
          id: advisor.id,
          slug: await ensureAdvisorSlug(this.prisma, advisor),
          displayName: advisor.displayName,
          profileImageUrl: advisor.profileImageUrl,
          ratePerMinute: advisor.ratePerMinute,
          isOnline: advisor.isOnline,
          busy: advisor.isOnline && (busyIds.has(advisor.id) || queueLength > 0),
          queueLength,
        };
      }),
    );

    // Stable sort: within each group the newest favourite stays first.
    const rank = (card: { isOnline: boolean; busy: boolean }) => (!card.isOnline ? 2 : card.busy ? 1 : 0);
    return cards.sort((a, b) => rank(a) - rank(b));
  }

  async isFavorite(userId: string, slugOrId: string) {
    const advisor = await this.findPublicAdvisor(slugOrId);
    const row = await this.prisma.favoriteAdvisor.findUnique({
      where: { userId_advisorId: { userId, advisorId: advisor.id } },
      select: { id: true },
    });
    return { favorite: row !== null };
  }

  /** Adds an advisor to the client's favourites or removes them. Doing either twice is harmless. */
  async setFavorite(userId: string, slugOrId: string, favorite: boolean) {
    const advisor = await this.findPublicAdvisor(slugOrId);
    const key = { userId_advisorId: { userId, advisorId: advisor.id } };

    if (!favorite) {
      await this.prisma.favoriteAdvisor.deleteMany({ where: { userId, advisorId: advisor.id } });
      return { favorite: false };
    }

    const existing = await this.prisma.favoriteAdvisor.findUnique({ where: key, select: { id: true } });
    if (!existing) {
      const count = await this.prisma.favoriteAdvisor.count({ where: { userId } });
      if (count >= MAX_FAVORITES) {
        throw new BadRequestException(`You can keep up to ${MAX_FAVORITES} favorite advisors. Remove one to add another.`);
      }
      await this.prisma.favoriteAdvisor.upsert({ where: key, create: { userId, advisorId: advisor.id }, update: {} });
    }
    return { favorite: true };
  }

  /**
   * An advisor's public profile page: who they are, their usual hours, and what clients say about them.
   * Works whether or not the advisor is online. Never exposes the advisor's phone number.
   */
  async getPublicProfile(slugOrId: string) {
    const advisor = await this.findPublicAdvisor(slugOrId);
    const slug = await ensureAdvisorSlug(this.prisma, advisor);

    const [slots, liveSession, ratings, reviews, queueLengths] = await Promise.all([
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
        where: { advisorId: advisor.id, hiddenAt: null },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.advisorReview.findMany({
        where: { advisorId: advisor.id, hiddenAt: null },
        select: { id: true, rating: true, comment: true, createdAt: true, user: { select: { username: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take: MAX_PUBLIC_REVIEWS,
      }),
      this.queueLengths([advisor.id]),
    ]);
    const queueLength = queueLengths.get(advisor.id) ?? 0;

    const average = ratings._avg.rating;
    return {
      id: advisor.id,
      slug,
      displayName: advisor.displayName,
      bio: advisor.bio,
      profileImageUrl: advisor.profileImageUrl,
      ratePerMinute: advisor.ratePerMinute,
      isOnline: advisor.isOnline,
      busy: advisor.isOnline && (liveSession !== null || queueLength > 0),
      queueEnabled: advisor.queueCallingEnabled,
      queueLength,
      // How to reach this advisor by phoning the hotline, when both the hotline and their extension are set up.
      hotline: this.hotlineFor(advisor.sipExtension),
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
        reviewerName: publicName(review.user),
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

  /**
   * Saves the client's star rating and comment. Only clients who have actually spoken with the advisor can, and a
   * review cannot be changed once it is posted (an admin can remove it, after which the client may post a new one).
   */
  async submitReview(userId: string, slugOrId: string, dto: SubmitReviewDto) {
    const advisor = await this.findPublicAdvisor(slugOrId);
    if (advisor.userId === userId) throw new ForbiddenException('You cannot review yourself.');
    if (!(await this.hasSpokenWith(userId, advisor.id))) {
      throw new ForbiddenException('You can review an advisor after you have spoken with them.');
    }

    const alreadyReviewed = new ConflictException('You have already reviewed this advisor. Reviews cannot be changed once posted.');
    const existing = await this.prisma.advisorReview.findUnique({
      where: { advisorId_userId: { advisorId: advisor.id, userId } },
      select: { id: true },
    });
    if (existing) throw alreadyReviewed;

    const comment = dto.comment?.trim() || null;
    try {
      return await this.prisma.advisorReview.create({
        data: { advisorId: advisor.id, userId, rating: dto.rating, comment },
        select: { rating: true, comment: true },
      });
    } catch (error) {
      // Two submissions at once: the unique constraint lets only the first one in.
      if ((error as { code?: string }).code === 'P2002') throw alreadyReviewed;
      throw error;
    }
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
  private hotlineFor(extension: string | null) {
    const configured = this.config.get<string>('TELNYX_HOTLINE_NUMBER');
    const number = configured ? normalizePhoneNumber(configured) : null;
    return number && extension ? { number, extension } : null;
  }

  /** How many clients are waiting in (or being called from) each advisor's queue. */
  private async queueLengths(advisorIds: string[]): Promise<Map<string, number>> {
    const spots = await this.prisma.queueAssignment.findMany({
      where: { status: { in: ['WAITING', 'CALLING'] }, queue: { advisorId: { in: advisorIds } } },
      select: { queue: { select: { advisorId: true } } },
    });
    const lengths = new Map<string, number>();
    for (const spot of spots) {
      lengths.set(spot.queue.advisorId, (lengths.get(spot.queue.advisorId) ?? 0) + 1);
    }
    return lengths;
  }

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
        queueCallingEnabled: true,
        sipExtension: true,
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

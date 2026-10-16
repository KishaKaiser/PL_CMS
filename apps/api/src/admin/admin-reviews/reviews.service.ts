import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@pl-cms/db';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ModerateReviewDto } from './reviews.dto';

const MAX_ROWS = 200;

export type ReviewStatusFilter = 'all' | 'visible' | 'hidden';

@Injectable()
export class AdminReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Every advisor review, newest first. Admins see who wrote it; the public only ever sees a username. */
  async list(filter: { status?: string; advisorId?: string; search?: string }) {
    const status = (filter.status ?? 'all') as ReviewStatusFilter;
    if (!['all', 'visible', 'hidden'].includes(status)) throw new BadRequestException('Unknown status filter.');

    const search = filter.search?.trim();
    const where: Prisma.AdvisorReviewWhereInput = {
      ...(status === 'hidden' ? { hiddenAt: { not: null } } : {}),
      ...(status === 'visible' ? { hiddenAt: null } : {}),
      ...(filter.advisorId ? { advisorId: filter.advisorId } : {}),
      ...(search
        ? {
            OR: [
              { comment: { contains: search, mode: 'insensitive' } },
              { user: { username: { contains: search, mode: 'insensitive' } } },
              { user: { email: { contains: search, mode: 'insensitive' } } },
              { advisor: { displayName: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [rows, total, hidden] = await Promise.all([
      this.prisma.advisorReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: MAX_ROWS,
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          updatedAt: true,
          hiddenAt: true,
          hiddenReason: true,
          advisor: { select: { id: true, displayName: true, slug: true } },
          user: { select: { id: true, username: true, name: true, email: true } },
        },
      }),
      this.prisma.advisorReview.count(),
      this.prisma.advisorReview.count({ where: { hiddenAt: { not: null } } }),
    ]);

    return {
      counts: { total, hidden, visible: total - hidden },
      reviews: rows.map(({ hiddenAt, ...review }) => ({ ...review, hidden: hiddenAt !== null, hiddenAt })),
    };
  }

  /** The advisors that have reviews, for the filter drop-down. */
  listAdvisors() {
    return this.prisma.advisorProfile.findMany({
      where: { reviews: { some: {} } },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
    });
  }

  async setHidden(actorId: string, id: string, dto: ModerateReviewDto) {
    const review = await this.prisma.advisorReview.findUnique({
      where: { id },
      select: { id: true, advisorId: true, userId: true, hiddenAt: true },
    });
    if (!review) throw new NotFoundException('Review not found');

    const reason = dto.hidden ? dto.reason?.trim() || null : null;
    const updated = await this.prisma.advisorReview.update({
      where: { id },
      data: { hiddenAt: dto.hidden ? (review.hiddenAt ?? new Date()) : null, hiddenReason: reason },
      select: { id: true, hiddenAt: true, hiddenReason: true },
    });

    await this.audit.log(actorId, dto.hidden ? 'review.hide' : 'review.show', 'AdvisorReview', id, {
      advisorId: review.advisorId,
      reviewerId: review.userId,
      ...(reason ? { reason } : {}),
    });

    return { id: updated.id, hidden: updated.hiddenAt !== null, hiddenReason: updated.hiddenReason };
  }

  /** Permanently removes a review. The client can then write a new one after another call. */
  async remove(actorId: string, id: string) {
    const review = await this.prisma.advisorReview.findUnique({
      where: { id },
      select: { id: true, advisorId: true, userId: true, rating: true, comment: true },
    });
    if (!review) throw new NotFoundException('Review not found');

    await this.prisma.advisorReview.delete({ where: { id } });
    await this.audit.log(actorId, 'review.delete', 'AdvisorReview', id, {
      advisorId: review.advisorId,
      reviewerId: review.userId,
      rating: review.rating,
      comment: review.comment,
    });
  }
}

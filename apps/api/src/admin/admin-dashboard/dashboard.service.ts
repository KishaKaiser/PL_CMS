import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const now = new Date();

    const [
      totalPosts,
      publishedPosts,
      draftPosts,
      scheduledPosts,
      totalPages,
      publishedPages,
      draftPages,
      recentPosts,
      recentPages,
      recentAuditLogs,
    ] = await Promise.all([
      this.prisma.post.count(),
      this.prisma.post.count({ where: { publishedAt: { lte: now, not: null } } }),
      this.prisma.post.count({ where: { publishedAt: null } }),
      this.prisma.post.count({ where: { publishedAt: { gt: now } } }),
      this.prisma.page.count(),
      this.prisma.page.count({ where: { publishedAt: { lte: now, not: null } } }),
      this.prisma.page.count({ where: { publishedAt: null } }),
      this.prisma.post.findMany({
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          slug: true,
          publishedAt: true,
          updatedAt: true,
          author: { select: { name: true, username: true } },
        },
      }),
      this.prisma.page.findMany({
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, slug: true, publishedAt: true, updatedAt: true },
      }),
      this.prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { name: true, email: true } } },
      }),
    ]);

    return {
      posts: {
        total: totalPosts,
        published: publishedPosts,
        draft: draftPosts,
        scheduled: scheduledPosts,
      },
      pages: { total: totalPages, published: publishedPages, draft: draftPages },
      recentPosts,
      recentPages,
      recentAuditLogs,
    };
  }
}

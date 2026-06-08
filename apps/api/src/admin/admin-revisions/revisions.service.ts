import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { sanitizeCmsHtml } from '../admin-content/cms-content.util';

@Injectable()
export class RevisionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listRevisions(entityType: string, entityId: string) {
    return this.prisma.contentRevision.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        isAutosave: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async saveRevision(
    entityType: 'POST' | 'PAGE',
    entityId: string,
    snapshot: Record<string, unknown>,
    isAutosave: boolean,
    actorId: string,
  ) {
    if (isAutosave) {
      await this.prisma.contentRevision.deleteMany({
        where: { entityType, entityId, isAutosave: true },
      });
    }

    return this.prisma.contentRevision.create({
      data: {
        entityType,
        entityId,
        title: (snapshot.title as string) ?? '',
        content: (snapshot.content as string) ?? '',
        snapshot: snapshot as never,
        isAutosave,
        createdById: actorId,
      },
    });
  }

  async autosave(
    entityType: 'POST' | 'PAGE',
    entityId: string,
    data: Record<string, unknown>,
    actorId: string,
  ) {
    if (entityType === 'POST') {
      const exists = await this.prisma.post.findUnique({
        where: { id: entityId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Post not found');
    } else {
      const exists = await this.prisma.page.findUnique({
        where: { id: entityId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Page not found');
    }

    return this.saveRevision(entityType, entityId, data, true, actorId);
  }

  async restoreRevision(
    entityType: string,
    entityId: string,
    revisionId: string,
    _actorId: string,
  ) {
    const revision = await this.prisma.contentRevision.findUnique({ where: { id: revisionId } });
    if (!revision || revision.entityType !== entityType || revision.entityId !== entityId) {
      throw new NotFoundException('Revision not found');
    }

    const snapshot = revision.snapshot as Record<string, unknown>;

    if (entityType === 'POST') {
      return this.prisma.post.update({
        where: { id: entityId },
        data: {
          title: snapshot.title as string,
          content: sanitizeCmsHtml(snapshot.content as string),
          excerpt: (snapshot.excerpt as string) ?? null,
          metaTitle: (snapshot.metaTitle as string) ?? null,
          metaDescription: (snapshot.metaDescription as string) ?? null,
        },
      });
    }

    return this.prisma.page.update({
      where: { id: entityId },
      data: {
        title: snapshot.title as string,
        content: sanitizeCmsHtml(snapshot.content as string),
        metaTitle: (snapshot.metaTitle as string) ?? null,
        metaDescription: (snapshot.metaDescription as string) ?? null,
      },
    });
  }
}

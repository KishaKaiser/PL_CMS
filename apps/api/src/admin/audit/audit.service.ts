import { Injectable } from '@nestjs/common';
import type { Prisma } from '@pl-cms/db';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filter?: { entity?: string; actorId?: string; from?: string; to?: string }) {
    return this.prisma.auditLog.findMany({
      where: {
        entity: filter?.entity ?? undefined,
        actorId: filter?.actorId ?? undefined,
        createdAt: {
          gte: filter?.from ? new Date(filter.from) : undefined,
          lte: filter?.to ? new Date(filter.to) : undefined,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { actor: { select: { id: true, email: true, name: true } } },
    });
  }

  log(
    actorId: string,
    action: string,
    entity: string,
    entityId?: string,
    meta?: Prisma.InputJsonObject,
  ) {
    return this.prisma.auditLog.create({
      data: { actorId, action, entity, entityId, meta },
    });
  }
}

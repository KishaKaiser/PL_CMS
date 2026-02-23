import { Injectable } from '@nestjs/common';
import type { Prisma } from '@pl-cms/db';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { actor: { select: { id: true, email: true, name: true } } },
    });
  }

  log(actorId: string, action: string, entity: string, entityId?: string, meta?: Prisma.InputJsonObject) {
    return this.prisma.auditLog.create({
      data: { actorId, action, entity, entityId, meta },
    });
  }
}

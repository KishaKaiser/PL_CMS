import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateModuleDto, UpdateModuleDto } from './modules.dto';

@Injectable()
export class ModulesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.module.findMany({
      orderBy: [{ enabled: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const module = await this.prisma.module.findUnique({ where: { id } });
    if (!module) throw new NotFoundException(`Module ${id} not found`);
    return module;
  }

  async create(dto: CreateModuleDto) {
    const existing = await this.prisma.module.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Module "${dto.name}" is already installed`);

    return this.prisma.module.create({
      data: {
        name: dto.name,
        version: dto.version,
        enabled: dto.enabled ?? false,
        config: toJsonObject(dto.config),
      },
    });
  }

  async update(id: string, dto: UpdateModuleDto) {
    await this.findOne(id);
    return this.prisma.module.update({
      where: { id },
      data: {
        ...(dto.version !== undefined ? { version: dto.version } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.config !== undefined ? { config: toJsonObject(dto.config) } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.module.delete({ where: { id } });
  }
}

function toJsonObject(value: Record<string, unknown> | undefined): Prisma.InputJsonObject {
  return (value ?? {}) as Prisma.InputJsonObject;
}

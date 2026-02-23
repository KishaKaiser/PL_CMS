import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertSettingDto } from './settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.setting.findMany({ orderBy: { key: 'asc' } });
  }

  findOne(key: string) {
    return this.prisma.setting.findUnique({ where: { key } });
  }

  upsert(key: string, dto: UpsertSettingDto) {
    return this.prisma.setting.upsert({
      where: { key },
      update: { value: dto.value },
      create: { key, value: dto.value },
    });
  }

  async remove(key: string) {
    const existing = await this.prisma.setting.findUnique({ where: { key } });
    if (!existing) throw new NotFoundException(`Setting with key "${key}" not found`);
    return this.prisma.setting.delete({ where: { key } });
  }
}

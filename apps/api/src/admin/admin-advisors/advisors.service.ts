import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateAdvisorExtensionDto } from './advisors.dto';

@Injectable()
export class AdminAdvisorsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.advisorProfile.findMany({
      select: {
        id: true,
        displayName: true,
        ratePerMinute: true,
        isOnline: true,
        sipExtension: true,
        queueCallingEnabled: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { displayName: 'asc' },
    });
  }

  async updateExtension(id: string, dto: UpdateAdvisorExtensionDto) {
    const advisor = await this.prisma.advisorProfile.findUnique({ where: { id } });
    if (!advisor) throw new NotFoundException('Advisor not found');

    return this.prisma.advisorProfile.update({
      where: { id },
      data: { sipExtension: dto.sipExtension?.trim() || null },
    });
  }
}

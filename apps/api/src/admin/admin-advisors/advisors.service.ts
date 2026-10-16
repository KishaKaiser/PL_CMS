import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
        phoneNumber: true,
        queueCallingEnabled: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { displayName: 'asc' },
    });
  }

  async updateExtension(id: string, dto: UpdateAdvisorExtensionDto) {
    const advisor = await this.prisma.advisorProfile.findUnique({ where: { id } });
    if (!advisor) throw new NotFoundException('Advisor not found');

    // Callers key the extension in on the phone, so it is digits only, and each one belongs to a single advisor.
    const sipExtension = dto.sipExtension?.trim() || null;
    if (sipExtension) {
      if (!/^[0-9]{2,6}$/.test(sipExtension)) {
        throw new BadRequestException('An extension is 2 to 6 digits, with no spaces or letters.');
      }
      const taken = await this.prisma.advisorProfile.findFirst({
        where: { sipExtension, id: { not: id } },
        select: { displayName: true },
      });
      if (taken) throw new ConflictException(`Extension ${sipExtension} already belongs to ${taken.displayName}.`);
    }

    return this.prisma.advisorProfile.update({
      where: { id },
      data: { sipExtension },
    });
  }
}

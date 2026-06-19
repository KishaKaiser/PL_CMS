import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Role } from '@pl-cms/shared';
import { normalizeEmailInput } from '../../common/input-normalization.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto, UpdateUserRoleDto, ResetPasswordDto } from './users.dto';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async create(dto: CreateUserDto) {
    const email = normalizeEmailInput(dto.email);
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Name is required');

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException(`User with email "${email}" already exists`);

    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name,
          role: dto.role,
          passwordHash,
        },
        select: { id: true, email: true, name: true, role: true, createdAt: true },
      });

      if (dto.role === Role.CLIENT) {
        await tx.clientProfile.create({
          data: { userId: user.id, displayName: user.name },
        });
      }

      if (dto.role === Role.ADVISOR) {
        await tx.advisorProfile.create({
          data: { userId: user.id, displayName: user.name },
        });
      }

      return user;
    });
  }

  async updateRole(id: string, dto: UpdateUserRoleDto) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
  }

  async resetPassword(id: string, dto: ResetPasswordDto) {
    await this.findOne(id);
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    return { message: 'Password reset successfully' };
  }
}

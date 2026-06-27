import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@pl-cms/db';
import * as bcrypt from 'bcryptjs';
import { Role } from '@pl-cms/shared';
import { normalizeEmailInput } from '../../common/input-normalization.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto, UpdateUserRoleDto, ResetPasswordDto } from './users.dto';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: userSelect,
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async create(dto: CreateUserDto) {
    const email = normalizeEmailInput(dto.email);
    const username = normalizeUsername(dto.username);
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Name is required');

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException(`User with email "${email}" already exists`);
    if (username) {
      const existingUsername = await this.prisma.user.findUnique({ where: { username } });
      if (existingUsername) throw new ConflictException(`Username "${username}" already exists`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          username,
          name,
          role: dto.role,
          passwordHash,
        },
        select: userSelect,
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
    return this.update(id, { ...(await this.findOne(id)), role: dto.role });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    const email = normalizeEmailInput(dto.email);
    const username = normalizeUsername(dto.username ?? undefined);
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Name is required');

    const existingEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existingEmail && existingEmail.id !== id) {
      throw new ConflictException(`User with email "${email}" already exists`);
    }

    if (username) {
      const existingUsername = await this.prisma.user.findUnique({ where: { username } });
      if (existingUsername && existingUsername.id !== id) {
        throw new ConflictException(`Username "${username}" already exists`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          email,
          username,
          name,
          role: dto.role,
        },
        select: userSelect,
      });

      if (dto.role === Role.CLIENT) {
        await tx.clientProfile.upsert({
          where: { userId: id },
          update: { displayName: name },
          create: { userId: id, displayName: name },
        });
      }

      if (dto.role === Role.ADVISOR) {
        await tx.advisorProfile.upsert({
          where: { userId: id },
          update: { displayName: name },
          create: { userId: id, displayName: name },
        });
      }

      return user;
    });
  }

  async resetPassword(id: string, dto: ResetPasswordDto) {
    await this.findOne(id);
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    return { message: 'Password reset successfully' };
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      await this.prisma.user.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException(
          'This user is connected to posts, orders, messages, or other records and cannot be deleted yet.',
        );
      }
      throw error;
    }
  }
}

const userSelect = { id: true, email: true, username: true, name: true, role: true, createdAt: true } as const;

function normalizeUsername(value?: string) {
  const username = value?.trim().toLowerCase();
  return username || null;
}

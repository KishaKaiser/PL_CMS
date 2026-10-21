import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@pl-cms/shared';
import { normalizeEmailInput } from '../common/input-normalization.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateUser(identifier: string, password: string) {
    const normalizedIdentifier = normalizeEmailInput(identifier);
    if (typeof normalizedIdentifier !== 'string') throw new UnauthorizedException('Invalid credentials');

    const user = normalizedIdentifier.includes('@')
      ? await this.prisma.user.findUnique({
          where: { email: normalizedIdentifier },
          select: {
            id: true,
            email: true,
            passwordHash: true,
            role: true,
          },
        })
      : await this.findUserByUsername(normalizedIdentifier);

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return user;
  }

  private async findUserByUsername(username: string) {
    if (!username) throw new UnauthorizedException('Invalid credentials');

    try {
      return await this.prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          email: true,
          passwordHash: true,
          role: true,
        },
      });
    } catch {
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    return this.generateTokens(user.id, user.email, user.role as Role);
  }

  /** Signs a user in without a password: for flows that have just proven who they are another way (the emailed onboarding link). */
  async issueSession(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return this.generateTokens(user.id, user.email, user.role as Role);
  }

  async refresh(token: string) {
    let payload: { sub: string; email: string; role: Role };
    try {
      payload = this.jwt.verify(token, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (await this.isLockedOut(payload.sub, payload.role)) throw new UnauthorizedException('This account is no longer active.');
    return this.generateTokens(payload.sub, payload.email, payload.role);
  }

  /** An advisor whose onboarding an admin cancelled can no longer use the site, even with a sign-in that is still valid. */
  async isLockedOut(userId: string, role: string): Promise<boolean> {
    if (role !== 'ADVISOR') return false;
    const cancelled = await this.prisma.advisorOnboarding.findFirst({
      where: { cancelledAt: { not: null }, advisor: { userId } },
      select: { id: true },
    });
    return !!cancelled;
  }

  private generateTokens(sub: string, email: string, role: Role) {
    const accessToken = this.jwt.sign(
      { sub, email, role },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m',
      },
    );

    const refreshToken = this.jwt.sign(
      { sub, email, role },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
      },
    );

    return { accessToken, refreshToken, role };
  }
}

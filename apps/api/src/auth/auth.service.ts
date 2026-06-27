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

  async refresh(token: string) {
    try {
      const payload = this.jwt.verify(token, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
      return this.generateTokens(payload.sub, payload.email, payload.role);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
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

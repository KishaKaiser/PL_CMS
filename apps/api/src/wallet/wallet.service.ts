import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(userId: string) {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId },
      select: { balanceMinutes: true },
    });
    if (!profile) throw new NotFoundException('Client profile not found');
    return { balanceMinutes: profile.balanceMinutes };
  }

  getTransactions(userId: string) {
    return this.prisma.walletTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

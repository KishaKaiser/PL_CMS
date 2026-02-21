import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MAX_TRANSACTIONS_LIMIT = 100;
const DEFAULT_TRANSACTIONS_LIMIT = 20;

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

  getTransactions(userId: string, limit?: number, cursor?: string) {
    const take = Math.min(limit ?? DEFAULT_TRANSACTIONS_LIMIT, MAX_TRANSACTIONS_LIMIT);
    return this.prisma.walletTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  }
}

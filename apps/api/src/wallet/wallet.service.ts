import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MAX_TRANSACTIONS_LIMIT = 100;
const DEFAULT_TRANSACTIONS_LIMIT = 20;
const WALLET_CREDIT_PRODUCT_NAME = 'Wallet Credit';
/** Remembers that the wallet credit product has been hidden from the shop once, so an admin who shows it again is respected. */
const HIDDEN_ONCE_SETTING_KEY = 'wallet_credit_hidden_once';

@Injectable()
export class WalletService implements OnModuleInit {
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * The wallet credit product is bought through Add Funds, so it should not appear in the shop or its filters. A product that
   * already exists is hidden the first time the site starts with this feature; after that it is left however the admin set it.
   */
  async onModuleInit() {
    try {
      const done = await this.prisma.setting.findUnique({ where: { key: HIDDEN_ONCE_SETTING_KEY } });
      if (done) return;
      await this.prisma.product.updateMany({
        where: { type: 'MINUTE_PACK', name: WALLET_CREDIT_PRODUCT_NAME, hiddenFromShop: false },
        data: { hiddenFromShop: true },
      });
      await this.prisma.setting.upsert({
        where: { key: HIDDEN_ONCE_SETTING_KEY },
        create: { key: HIDDEN_ONCE_SETTING_KEY, value: new Date().toISOString() },
        update: { value: new Date().toISOString() },
      });
    } catch (error) {
      this.logger.warn(`Could not hide the wallet credit product from the shop: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getBalance(userId: string) {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId },
      select: { balanceCents: true },
    });
    if (!profile) throw new NotFoundException('Client profile not found');
    return { balanceCents: profile.balanceCents };
  }

  /**
   * The $1.00-per-unit product a client buys in any quantity to top up their
   * wallet. Created on first use so no admin setup is needed. Paying for N of
   * it credits N dollars, via the same minutes-pack crediting as any wallet pack.
   */
  async getCreditProduct() {
    const select = { id: true, name: true, price: true, currency: true } as const;
    const where = { type: 'MINUTE_PACK', name: WALLET_CREDIT_PRODUCT_NAME, isActive: true } as const;

    const existing = await this.prisma.product.findFirst({ where, select });
    if (existing) return existing;

    return this.prisma.product.create({
      data: {
        name: WALLET_CREDIT_PRODUCT_NAME,
        type: 'MINUTE_PACK',
        description: 'Pre-paid balance for phone readings. Each unit adds $1.00 to your wallet.',
        price: 1,
        currency: 'USD',
        minutesPack: 1,
        isActive: true,
        // Bought through Add Funds, not browsed in the shop.
        hiddenFromShop: true,
      },
      select,
    });
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

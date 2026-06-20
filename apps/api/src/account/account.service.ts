import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import {
  SaveAddressDto,
  SavePaymentMethodDto,
  SavePayoutMethodDto,
  UpdateAccountDto,
  UpdateAdvisorProfileDto,
} from './account.dto';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        clientProfile: true,
        advisorProfile: true,
      },
    });
    if (!user) throw new NotFoundException('Account not found');

    const [orders, addresses, paymentMethods, walletTransactions, conversations] =
      await Promise.all([
        this.prisma.order.findMany({
          where: { userId },
          include: {
            items: { include: { product: true } },
            shippingAddress: true,
            payments: true,
            shipments: { orderBy: { createdAt: 'desc' } },
          },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
        this.prisma.accountAddress.findMany({
          where: { userId },
          orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
        }),
        this.prisma.savedPaymentMethod.findMany({
          where: { userId },
          orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
        }),
        this.prisma.walletTransaction.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
        this.prisma.message.findMany({
          where: { recipientId: userId, readAt: null },
          select: { id: true },
        }),
      ]);

    const payoutMethods =
      user.advisorProfile
        ? await this.prisma.advisorPayoutMethod.findMany({
            where: { advisorId: user.advisorProfile.id },
            orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
          })
        : [];

    const callTransactions =
      user.advisorProfile
        ? await this.prisma.callSession.findMany({
            where: { advisorId: user.advisorProfile.id },
            include: { client: { include: { user: { select: { name: true, email: true } } } } },
            orderBy: { startedAt: 'desc' },
            take: 8,
          })
        : [];

    return {
      user,
      orders,
      addresses,
      paymentMethods,
      wallet: {
        balanceMinutes: user.clientProfile?.balanceMinutes ?? null,
        transactions: walletTransactions,
      },
      messages: { unreadCount: conversations.length },
      advisor: user.advisorProfile
        ? { profile: user.advisorProfile, payoutMethods, callTransactions }
        : null,
    };
  }

  async updateAccount(userId: string, dto: UpdateAccountDto) {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('Name is required');
    return this.prisma.user.update({
      where: { id: userId },
      data: { name },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
  }

  listAddresses(userId: string) {
    return this.prisma.accountAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async createAddress(userId: string, dto: SaveAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.accountAddress.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      return tx.accountAddress.create({
        data: { ...cleanAddress(dto), userId, isDefault: dto.isDefault ?? false },
      });
    });
  }

  async updateAddress(userId: string, id: string, dto: SaveAddressDto) {
    await this.ensureOwnedAddress(userId, id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.accountAddress.updateMany({
          where: { userId, id: { not: id } },
          data: { isDefault: false },
        });
      }

      return tx.accountAddress.update({
        where: { id },
        data: { ...cleanAddress(dto), isDefault: dto.isDefault ?? false },
      });
    });
  }

  async removeAddress(userId: string, id: string) {
    await this.ensureOwnedAddress(userId, id);
    return this.prisma.accountAddress.delete({ where: { id } });
  }

  listPaymentMethods(userId: string) {
    return this.prisma.savedPaymentMethod.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async createPaymentMethod(userId: string, dto: SavePaymentMethodDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.savedPaymentMethod.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      return tx.savedPaymentMethod.create({
        data: { ...cleanPaymentMethod(dto), userId, isDefault: dto.isDefault ?? false },
      });
    });
  }

  async removePaymentMethod(userId: string, id: string) {
    const method = await this.prisma.savedPaymentMethod.findFirst({ where: { id, userId } });
    if (!method) throw new NotFoundException(`Payment method ${id} not found`);
    return this.prisma.savedPaymentMethod.delete({ where: { id } });
  }

  async updateAdvisorProfile(userId: string, dto: UpdateAdvisorProfileDto) {
    const advisor = await this.getAdvisorProfileForUser(userId);
    return this.prisma.advisorProfile.update({
      where: { id: advisor.id },
      data: {
        ...(dto.displayName !== undefined ? { displayName: dto.displayName.trim() } : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio.trim() || null } : {}),
        ...(dto.ratePerMinute !== undefined
          ? { ratePerMinute: new Decimal(dto.ratePerMinute) }
          : {}),
        ...(dto.isOnline !== undefined ? { isOnline: dto.isOnline } : {}),
      },
    });
  }

  async createPayoutMethod(userId: string, dto: SavePayoutMethodDto) {
    const advisor = await this.getAdvisorProfileForUser(userId);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.advisorPayoutMethod.updateMany({
          where: { advisorId: advisor.id },
          data: { isDefault: false },
        });
      }

      return tx.advisorPayoutMethod.create({
        data: {
          advisorId: advisor.id,
          label: dto.label.trim(),
          methodType: dto.methodType.trim(),
          accountName: dto.accountName.trim(),
          details: dto.details ?? {},
          isDefault: dto.isDefault ?? false,
        },
      });
    });
  }

  async removePayoutMethod(userId: string, id: string) {
    const advisor = await this.getAdvisorProfileForUser(userId);
    const method = await this.prisma.advisorPayoutMethod.findFirst({
      where: { id, advisorId: advisor.id },
    });
    if (!method) throw new NotFoundException(`Payout method ${id} not found`);
    return this.prisma.advisorPayoutMethod.delete({ where: { id } });
  }

  private async ensureOwnedAddress(userId: string, id: string) {
    const address = await this.prisma.accountAddress.findFirst({ where: { id, userId } });
    if (!address) throw new NotFoundException(`Address ${id} not found`);
  }

  private async getAdvisorProfileForUser(userId: string) {
    const advisor = await this.prisma.advisorProfile.findUnique({ where: { userId } });
    if (!advisor) throw new NotFoundException('Advisor profile not found');
    return advisor;
  }
}

function cleanAddress(dto: SaveAddressDto) {
  return {
    label: dto.label.trim(),
    fullName: dto.fullName.trim(),
    phone: dto.phone?.trim() || null,
    line1: dto.line1.trim(),
    line2: dto.line2?.trim() || null,
    city: dto.city.trim(),
    state: dto.state.trim(),
    postalCode: dto.postalCode.trim(),
    country: (dto.country?.trim() || 'US').toUpperCase(),
  };
}

function cleanPaymentMethod(dto: SavePaymentMethodDto) {
  return {
    label: dto.label.trim(),
    provider: dto.provider.trim(),
    brand: dto.brand?.trim() || null,
    last4: dto.last4?.trim() || null,
  };
}

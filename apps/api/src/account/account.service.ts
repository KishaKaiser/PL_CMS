import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@pl-cms/db';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { deriveMediaTitle, serializeMediaAsset } from '../admin/admin-media/media.util';
import { normalizePhoneNumber } from '../telephony/phone-number';
import { ensureAdvisorSlug } from '../billing/advisor-slug';
import {
  SaveAddressDto,
  SavePaymentMethodDto,
  SavePayoutMethodDto,
  UpdateAccountDto,
  UpdateAdvisorProfileDto,
  UpdateAdvisorScheduleDto,
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
        username: true,
        name: true,
        role: true,
        createdAt: true,
        clientProfile: true,
        advisorProfile: true,
      },
    });
    if (!user) throw new NotFoundException('Account not found');

    const [orders, addresses, paymentMethods, walletTransactions, conversations, downloads] =
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
        this.prisma.astrologyReport.findMany({
          where: { userId },
          include: {
            product: { select: { id: true, name: true } },
            order: { select: { id: true, status: true, createdAt: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 12,
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
            include: { client: { select: { displayName: true } } },
            orderBy: { startedAt: 'desc' },
            take: 8,
          })
        : [];

    // The advisor's public profile link and weekly hours, shown in their dashboard.
    const advisorSlug = user.advisorProfile ? await ensureAdvisorSlug(this.prisma, user.advisorProfile) : null;
    const schedule = user.advisorProfile
      ? await this.prisma.availabilitySchedule.findMany({
          where: { advisorId: user.advisorProfile.id },
          select: { dayOfWeek: true, startTime: true, endTime: true, timezone: true },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        })
      : [];

    return {
      user,
      orders,
      addresses,
      paymentMethods,
      wallet: {
        balanceCents: user.clientProfile?.balanceCents ?? null,
        transactions: walletTransactions,
      },
      messages: { unreadCount: conversations.length },
      downloads,
      advisor: user.advisorProfile
        ? { profile: { ...user.advisorProfile, slug: advisorSlug }, payoutMethods, callTransactions, schedule }
        : null,
    };
  }

  /** Replaces the advisor's weekly hours (shown on their public profile) with the ones they just saved. */
  async updateAdvisorSchedule(userId: string, dto: UpdateAdvisorScheduleDto) {
    const advisor = await this.getAdvisorProfileForUser(userId);

    try {
      new Intl.DateTimeFormat('en-US', { timeZone: dto.timezone });
    } catch {
      throw new BadRequestException('Choose a valid time zone.');
    }

    // HH:MM strings sort correctly as text.
    const slots = [...dto.slots].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
    for (const [index, slot] of slots.entries()) {
      if (slot.startTime >= slot.endTime) throw new BadRequestException('Each period must end after it starts.');
      const previous = slots[index - 1];
      if (previous && previous.dayOfWeek === slot.dayOfWeek && slot.startTime < previous.endTime) {
        throw new BadRequestException('Hours on the same day cannot overlap.');
      }
    }

    const saved = await this.prisma.$transaction(async (tx) => {
      await tx.availabilitySchedule.deleteMany({ where: { advisorId: advisor.id } });
      if (slots.length > 0) {
        await tx.availabilitySchedule.createMany({
          data: slots.map((slot) => ({
            advisorId: advisor.id,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            timezone: dto.timezone,
          })),
        });
      }
      return tx.availabilitySchedule.findMany({
        where: { advisorId: advisor.id },
        select: { dayOfWeek: true, startTime: true, endTime: true, timezone: true },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      });
    });

    return { timezone: dto.timezone, slots: saved };
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

    let phoneNumber: string | null | undefined;
    if (dto.phoneNumber !== undefined) {
      if (dto.phoneNumber.trim() === '') {
        phoneNumber = null;
      } else {
        const normalized = normalizePhoneNumber(dto.phoneNumber);
        if (!normalized) {
          throw new BadRequestException('Enter a valid phone number, including area code.');
        }
        phoneNumber = normalized;
      }
    }

    // Clients are connected by calling the advisor's phone, so they must have one on file to take calls.
    const finalPhoneNumber = phoneNumber !== undefined ? phoneNumber : advisor.phoneNumber;
    if (dto.isOnline === true && !finalPhoneNumber) {
      throw new BadRequestException('Add your phone number before turning on calls, so we know where to reach you.');
    }

    return this.prisma.advisorProfile.update({
      where: { id: advisor.id },
      data: {
        ...(phoneNumber !== undefined ? { phoneNumber } : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio.trim() || null } : {}),
        ...(dto.profileImageUrl !== undefined ? { profileImageUrl: dto.profileImageUrl.trim() || null } : {}),
        ...(dto.ratePerMinute !== undefined
          ? { ratePerMinute: new Decimal(dto.ratePerMinute) }
          : {}),
        ...(dto.isOnline !== undefined ? { isOnline: dto.isOnline } : {}),
      },
    });
  }

  async uploadAdvisorProfileImage(userId: string, file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('Choose a profile image to upload.');
    const advisor = await this.getAdvisorProfileForUser(userId);
    const asset = await this.prisma.mediaAsset.create({
      data: {
        originalName: file.originalname,
        storageKey: file.filename,
        title: deriveMediaTitle(file.originalname),
        altText: advisor.displayName,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
    });
    const media = serializeMediaAsset(asset);
    const profile = await this.prisma.advisorProfile.update({
      where: { id: advisor.id },
      data: { profileImageUrl: media.url },
    });
    return { profile, media };
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
          details: toJsonObject(dto.details),
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

function toJsonObject(value: Record<string, unknown> | undefined): Prisma.InputJsonObject {
  return (value ?? {}) as Prisma.InputJsonObject;
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

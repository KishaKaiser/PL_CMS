import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@pl-cms/db';
import { PrismaService } from '../prisma/prisma.service';
import { decryptJson, encryptJson } from './payout-crypto';
import { startOfMonth, validZone } from './payout-time';
import { RecordPayoutDto, SavePayoutDetailsDto } from './payouts.dto';

/**
 * Advisor earnings and payouts.
 *
 *  - When a call ends, the advisor earns their share of what the client was actually charged. Free minutes are
 *    charged at $0, so they earn nothing. The share is the advisor's own percentage if admin set one, otherwise the
 *    platform default, and it is fixed on the call when it ends (changing it later does not rewrite old calls).
 *  - Admin pays advisors outside the app and records each payment here. What an advisor is owed is everything they
 *    have earned minus everything recorded as paid.
 */

const SETTINGS_KEY = 'payout_settings';
export const DEFAULT_SHARE_PERCENT = 50;
export const EARNINGS_PAGE_SIZE = 25;
const ENCRYPTION_ERROR = 'Bank details cannot be stored securely on this server yet. Use PayPal, or ask the site owner to set PAYOUT_ENCRYPTION_KEY.';

export type PayoutMethodType = 'PAYPAL' | 'BANK' | 'OTHER';

interface StoredMethod {
  id: string;
  label: string;
  methodType: string;
  accountName: string;
  details: unknown;
  isDefault: boolean;
}

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ── Settings ───────────────────────────────────────────────────────────────

  async getDefaultShare(): Promise<number> {
    const row = await this.prisma.setting.findUnique({ where: { key: SETTINGS_KEY } });
    if (!row) return DEFAULT_SHARE_PERCENT;
    try {
      const value = Number((JSON.parse(row.value) as { defaultSharePercent?: unknown }).defaultSharePercent);
      return Number.isInteger(value) && value >= 0 && value <= 100 ? value : DEFAULT_SHARE_PERCENT;
    } catch {
      return DEFAULT_SHARE_PERCENT;
    }
  }

  async setDefaultShare(percent: number): Promise<number> {
    if (!Number.isInteger(percent) || percent < 0 || percent > 100) throw new BadRequestException('The share must be a whole number from 0 to 100.');
    const value = JSON.stringify({ defaultSharePercent: percent });
    await this.prisma.setting.upsert({ where: { key: SETTINGS_KEY }, create: { key: SETTINGS_KEY, value }, update: { value } });
    return percent;
  }

  // ── Earnings (recorded when a call ends) ───────────────────────────────────

  /** Records what the advisor earned from a finished call. Safe to call twice for the same call. */
  async recordEarning(callSessionId: string): Promise<void> {
    const session = await this.prisma.callSession.findUnique({
      where: { id: callSessionId },
      select: {
        id: true,
        advisorId: true,
        billedMinutes: true,
        billedAmountCents: true,
        freeMinutesUsed: true,
        endedAt: true,
        advisor: { select: { sharePercent: true } },
      },
    });
    // A call that never reached billing has nothing to earn from.
    if (!session || !session.endedAt || !session.billedMinutes) return;

    const existing = await this.prisma.advisorEarning.findUnique({ where: { callSessionId }, select: { id: true } });
    if (existing) return;

    const sharePercent = session.advisor.sharePercent ?? (await this.getDefaultShare());
    const chargedCents = session.billedAmountCents ?? 0;
    try {
      await this.prisma.advisorEarning.create({
        data: {
          advisorId: session.advisorId,
          callSessionId,
          billedMinutes: session.billedMinutes,
          freeMinutes: Math.min(session.freeMinutesUsed, session.billedMinutes),
          chargedCents,
          sharePercent,
          earnedCents: Math.floor((chargedCents * sharePercent) / 100),
          createdAt: session.endedAt,
        },
      });
    } catch (error) {
      // Two ends of the same call arriving together: the other one recorded it.
      this.logger.warn(`Earning for call ${callSessionId} not recorded: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  // ── The advisor's own view ─────────────────────────────────────────────────

  async myOverview(userId: string, timeZone: string | undefined, pageInput: number | undefined) {
    const advisor = await this.advisorOf(userId);
    const zone = validZone(timeZone);
    const now = new Date();
    const page = Number.isInteger(pageInput) && (pageInput as number) > 0 ? (pageInput as number) : 1;

    const sinceWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sinceMonth = startOfMonth(now, zone);

    const [all, week, month, paid, total, rows, payouts, defaultShare] = await Promise.all([
      this.sumEarned(advisor.id),
      this.sumEarned(advisor.id, sinceWeek),
      this.sumEarned(advisor.id, sinceMonth),
      this.prisma.advisorPayout.aggregate({ where: { advisorId: advisor.id }, _sum: { amountCents: true } }),
      this.prisma.advisorEarning.count({ where: { advisorId: advisor.id } }),
      this.prisma.advisorEarning.findMany({
        where: { advisorId: advisor.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * EARNINGS_PAGE_SIZE,
        take: EARNINGS_PAGE_SIZE,
        select: {
          id: true,
          createdAt: true,
          billedMinutes: true,
          freeMinutes: true,
          chargedCents: true,
          sharePercent: true,
          earnedCents: true,
          callSession: { select: { client: { select: { displayName: true } } } },
        },
      }),
      this.prisma.advisorPayout.findMany({
        where: { advisorId: advisor.id },
        orderBy: { paidAt: 'desc' },
        take: 50,
        select: { id: true, amountCents: true, method: true, reference: true, paidAt: true },
      }),
      this.getDefaultShare(),
    ]);

    const paidCents = paid._sum.amountCents ?? 0;
    return {
      timeZone: zone,
      sharePercent: advisor.sharePercent ?? defaultShare,
      summary: {
        last7DaysCents: week,
        thisMonthCents: month,
        allTimeCents: all,
        paidCents,
        owedCents: all - paidCents,
      },
      earnings: {
        page,
        pageSize: EARNINGS_PAGE_SIZE,
        total,
        rows: rows.map((row) => ({
          id: row.id,
          at: row.createdAt,
          client: row.callSession.client.displayName,
          billedMinutes: row.billedMinutes,
          freeMinutes: row.freeMinutes,
          chargedCents: row.chargedCents,
          sharePercent: row.sharePercent,
          earnedCents: row.earnedCents,
        })),
      },
      payouts,
    };
  }

  private async sumEarned(advisorId: string, since?: Date): Promise<number> {
    const sum = await this.prisma.advisorEarning.aggregate({
      where: { advisorId, ...(since ? { createdAt: { gte: since } } : {}) },
      _sum: { earnedCents: true },
    });
    return sum._sum.earnedCents ?? 0;
  }

  // ── Payout details (how the advisor wants to be paid) ──────────────────────

  async listMethods(userId: string) {
    const advisor = await this.advisorOf(userId);
    const methods = await this.prisma.advisorPayoutMethod.findMany({
      where: { advisorId: advisor.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return methods.map((method) => this.masked(method));
  }

  async saveMethod(userId: string, dto: SavePayoutDetailsDto) {
    const advisor = await this.advisorOf(userId);
    const accountName = dto.accountName.trim();
    if (!accountName) throw new BadRequestException('Enter the name on the account.');

    let label: string;
    let details: Prisma.InputJsonObject;
    if (dto.type === 'PAYPAL') {
      const email = dto.email?.trim().toLowerCase() ?? '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Enter the email address of your PayPal account.');
      label = `PayPal: ${email}`;
      details = { email };
    } else if (dto.type === 'BANK') {
      const bankName = dto.bankName?.trim() ?? '';
      const routing = (dto.routingNumber ?? '').replace(/[\s-]/g, '');
      const account = (dto.accountNumber ?? '').replace(/[\s-]/g, '');
      if (!bankName) throw new BadRequestException('Enter the name of your bank.');
      if (!/^[A-Za-z0-9]{4,20}$/.test(routing)) throw new BadRequestException('Enter your bank routing (or sort code) number.');
      if (!/^[A-Za-z0-9]{4,34}$/.test(account)) throw new BadRequestException('Enter your account number.');
      const secret = this.encryptionSecret();
      if (!secret) throw new BadRequestException(ENCRYPTION_ERROR);
      label = `${bankName} account ending ${account.slice(-4)}`;
      details = {
        bankName,
        routingLast4: routing.slice(-4),
        accountLast4: account.slice(-4),
        secret: encryptJson({ routingNumber: routing, accountNumber: account }, secret),
      };
    } else {
      const notes = dto.notes?.trim() ?? '';
      if (!notes) throw new BadRequestException('Tell us how you would like to be paid.');
      label = notes.length > 60 ? `${notes.slice(0, 57)}...` : notes;
      details = { notes };
    }

    const saved = await this.prisma.$transaction(async (tx) => {
      const first = (await tx.advisorPayoutMethod.count({ where: { advisorId: advisor.id } })) === 0;
      const makeDefault = dto.isDefault === true || first;
      if (makeDefault) await tx.advisorPayoutMethod.updateMany({ where: { advisorId: advisor.id }, data: { isDefault: false } });
      return tx.advisorPayoutMethod.create({
        data: { advisorId: advisor.id, label, methodType: dto.type, accountName, details, isDefault: makeDefault },
      });
    });
    return this.masked(saved);
  }

  async removeMethod(userId: string, id: string) {
    const advisor = await this.advisorOf(userId);
    const method = await this.prisma.advisorPayoutMethod.findFirst({ where: { id, advisorId: advisor.id } });
    if (!method) throw new NotFoundException('Payout details not found');
    await this.prisma.advisorPayoutMethod.delete({ where: { id } });
    // Keep a default if any are left.
    if (method.isDefault) {
      const next = await this.prisma.advisorPayoutMethod.findFirst({ where: { advisorId: advisor.id }, orderBy: { createdAt: 'desc' }, select: { id: true } });
      if (next) await this.prisma.advisorPayoutMethod.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return { id, deleted: true };
  }

  /** What the advisor sees: enough to recognise it, never the full account numbers. */
  masked(method: StoredMethod) {
    const details = (method.details ?? {}) as Record<string, unknown>;
    let summary: string;
    if (method.methodType === 'PAYPAL') summary = String(details.email ?? '');
    else if (method.methodType === 'BANK') summary = `${String(details.bankName ?? 'Bank')} · account ending ${String(details.accountLast4 ?? '')}`;
    else summary = String(details.notes ?? details.note ?? '');
    return {
      id: method.id,
      label: method.label,
      methodType: method.methodType,
      accountName: method.accountName,
      isDefault: method.isDefault,
      summary,
    };
  }

  /** What admin sees when paying: the full details, decrypted. */
  revealed(method: StoredMethod) {
    const base = this.masked(method);
    if (method.methodType !== 'BANK') return base;
    const details = (method.details ?? {}) as Record<string, unknown>;
    const secret = this.encryptionSecret();
    const decrypted = secret && typeof details.secret === 'string' ? decryptJson<{ routingNumber: string; accountNumber: string }>(details.secret, secret) : null;
    return {
      ...base,
      bankName: String(details.bankName ?? ''),
      routingNumber: decrypted?.routingNumber ?? null,
      accountNumber: decrypted?.accountNumber ?? null,
    };
  }

  private encryptionSecret(): string | null {
    return this.config.get<string>('PAYOUT_ENCRYPTION_KEY') || this.config.get<string>('JWT_REFRESH_SECRET') || null;
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  /** Every advisor with what they have earned, been paid and are owed. */
  async adminOverview() {
    const [defaultShare, advisors, earned, paid, methods] = await Promise.all([
      this.getDefaultShare(),
      this.prisma.advisorProfile.findMany({ select: { id: true, displayName: true, sharePercent: true }, orderBy: { displayName: 'asc' } }),
      this.prisma.advisorEarning.groupBy({ by: ['advisorId'], _sum: { earnedCents: true, chargedCents: true }, _count: { _all: true } }),
      this.prisma.advisorPayout.groupBy({ by: ['advisorId'], _sum: { amountCents: true } }),
      this.prisma.advisorPayoutMethod.groupBy({ by: ['advisorId'], _count: { _all: true } }),
    ]);
    const earnedBy = new Map(earned.map((row) => [row.advisorId, row]));
    const paidBy = new Map(paid.map((row) => [row.advisorId, row._sum.amountCents ?? 0]));
    const hasMethod = new Set(methods.map((row) => row.advisorId));

    const rows = advisors.map((advisor) => {
      const e = earnedBy.get(advisor.id);
      const earnedCents = e?._sum.earnedCents ?? 0;
      const paidCents = paidBy.get(advisor.id) ?? 0;
      return {
        advisorId: advisor.id,
        displayName: advisor.displayName,
        sharePercentOverride: advisor.sharePercent,
        sharePercent: advisor.sharePercent ?? defaultShare,
        calls: e?._count._all ?? 0,
        chargedCents: e?._sum.chargedCents ?? 0,
        earnedCents,
        paidCents,
        owedCents: earnedCents - paidCents,
        hasPayoutDetails: hasMethod.has(advisor.id),
      };
    });
    rows.sort((a, b) => b.owedCents - a.owedCents || a.displayName.localeCompare(b.displayName));
    return {
      defaultSharePercent: defaultShare,
      totals: {
        chargedCents: rows.reduce((sum, r) => sum + r.chargedCents, 0),
        earnedCents: rows.reduce((sum, r) => sum + r.earnedCents, 0),
        paidCents: rows.reduce((sum, r) => sum + r.paidCents, 0),
        owedCents: rows.reduce((sum, r) => sum + r.owedCents, 0),
      },
      advisors: rows,
    };
  }

  /** One advisor for the admin: how to pay them (in full), what they are owed, and recent history. */
  async adminAdvisor(advisorId: string) {
    const advisor = await this.prisma.advisorProfile.findUnique({
      where: { id: advisorId },
      select: { id: true, displayName: true, sharePercent: true },
    });
    if (!advisor) throw new NotFoundException('Advisor not found');

    const [defaultShare, earned, paid, methods, payouts, recent] = await Promise.all([
      this.getDefaultShare(),
      this.sumEarned(advisorId),
      this.prisma.advisorPayout.aggregate({ where: { advisorId }, _sum: { amountCents: true } }),
      this.prisma.advisorPayoutMethod.findMany({ where: { advisorId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] }),
      this.prisma.advisorPayout.findMany({ where: { advisorId }, orderBy: { paidAt: 'desc' }, take: 50 }),
      this.prisma.advisorEarning.findMany({
        where: { advisorId },
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: {
          id: true,
          createdAt: true,
          billedMinutes: true,
          freeMinutes: true,
          chargedCents: true,
          sharePercent: true,
          earnedCents: true,
          callSession: { select: { client: { select: { displayName: true } } } },
        },
      }),
    ]);
    const paidCents = paid._sum.amountCents ?? 0;
    return {
      advisorId: advisor.id,
      displayName: advisor.displayName,
      sharePercentOverride: advisor.sharePercent,
      sharePercent: advisor.sharePercent ?? defaultShare,
      earnedCents: earned,
      paidCents,
      owedCents: earned - paidCents,
      payoutMethods: methods.map((method) => this.revealed(method)),
      payouts: payouts.map((payout) => ({
        id: payout.id,
        amountCents: payout.amountCents,
        method: payout.method,
        reference: payout.reference,
        note: payout.note,
        paidAt: payout.paidAt,
      })),
      recentEarnings: recent.map((row) => ({
        id: row.id,
        at: row.createdAt,
        client: row.callSession.client.displayName,
        billedMinutes: row.billedMinutes,
        freeMinutes: row.freeMinutes,
        chargedCents: row.chargedCents,
        sharePercent: row.sharePercent,
        earnedCents: row.earnedCents,
      })),
    };
  }

  /** Sets one advisor's own share, or null to follow the platform default. Only affects calls from now on. */
  async setAdvisorShare(advisorId: string, percent: number | null | undefined) {
    if (percent != null && (!Number.isInteger(percent) || percent < 0 || percent > 100)) {
      throw new BadRequestException('The share must be a whole number from 0 to 100.');
    }
    const advisor = await this.prisma.advisorProfile.findUnique({ where: { id: advisorId }, select: { id: true } });
    if (!advisor) throw new NotFoundException('Advisor not found');
    await this.prisma.advisorProfile.update({ where: { id: advisorId }, data: { sharePercent: percent ?? null } });
    return { advisorId, sharePercent: percent ?? null };
  }

  /** Records a payment made to an advisor. It cannot be more than they are owed. */
  async recordPayout(adminId: string, advisorId: string, dto: RecordPayoutDto) {
    const advisor = await this.prisma.advisorProfile.findUnique({ where: { id: advisorId }, select: { id: true } });
    if (!advisor) throw new NotFoundException('Advisor not found');

    let paidAt = new Date();
    if (dto.paidAt) {
      paidAt = new Date(dto.paidAt);
      if (Number.isNaN(paidAt.getTime())) throw new BadRequestException('The payment date is not valid.');
      if (paidAt.getTime() > Date.now() + 24 * 60 * 60 * 1000) throw new BadRequestException('The payment date cannot be in the future.');
    }

    return this.prisma.$transaction(async (tx) => {
      const [earned, paid, method] = await Promise.all([
        tx.advisorEarning.aggregate({ where: { advisorId }, _sum: { earnedCents: true } }),
        tx.advisorPayout.aggregate({ where: { advisorId }, _sum: { amountCents: true } }),
        tx.advisorPayoutMethod.findFirst({ where: { advisorId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] }),
      ]);
      const owed = (earned._sum.earnedCents ?? 0) - (paid._sum.amountCents ?? 0);
      if (dto.amountCents > owed) {
        throw new BadRequestException(`This advisor is owed $${(Math.max(owed, 0) / 100).toFixed(2)}, so you cannot record a payment of $${(dto.amountCents / 100).toFixed(2)}.`);
      }
      return tx.advisorPayout.create({
        data: {
          advisorId,
          amountCents: dto.amountCents,
          method: method ? method.label : 'Not recorded',
          reference: dto.reference?.trim() || null,
          note: dto.note?.trim() || null,
          paidAt,
          createdByUserId: adminId,
        },
        select: { id: true, amountCents: true, method: true, reference: true, note: true, paidAt: true },
      });
      // Serializable, so two payments recorded at the same moment cannot together exceed what is owed.
    }, { isolationLevel: 'Serializable' });
  }

  /** Removes a payment that was recorded by mistake; the amount goes back to what the advisor is owed. */
  async deletePayout(payoutId: string) {
    const payout = await this.prisma.advisorPayout.findUnique({ where: { id: payoutId }, select: { id: true, advisorId: true, amountCents: true } });
    if (!payout) throw new NotFoundException('Payment not found');
    await this.prisma.advisorPayout.delete({ where: { id: payoutId } });
    return payout;
  }

  private async advisorOf(userId: string) {
    const advisor = await this.prisma.advisorProfile.findUnique({ where: { userId }, select: { id: true, sharePercent: true } });
    if (!advisor) throw new NotFoundException('Advisor profile not found');
    return advisor;
  }
}

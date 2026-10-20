import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { startOfMonth, validZone } from './payout-time';
import { RecordPayoutDto, SetPayoutMethodDto } from './payouts.dto';

/**
 * Advisor earnings and payouts.
 *
 *  - When a call ends, the advisor earns their share of what the client was actually charged. Free minutes are
 *    charged at $0, so they earn nothing. The share is the advisor's own percentage if admin set one, otherwise the
 *    platform default, and it is fixed on the call when it ends (changing it later does not rewrite old calls).
 *  - Admin pays advisors outside the app and records each payment here. What an advisor is owed is everything they
 *    have earned minus everything recorded as paid.
 *  - A fee (3% unless admin changes it) is taken from each payment made by PayPal, to cover PayPal's charges: the
 *    payment clears the full amount from what the advisor is owed, and they receive that amount less the fee.
 *    Direct Deposit has no fee.
 *  - An advisor is paid by PayPal (to the email they give) or by Direct Deposit. This site never stores bank details:
 *    they are given to Support during onboarding, and Support marks the advisor's bank information as received, which
 *    is what lets the advisor choose Direct Deposit.
 */

const SETTINGS_KEY = 'payout_settings';
export const DEFAULT_SHARE_PERCENT = 50;
export const EARNINGS_PAGE_SIZE = 25;
/** PayPal payments to advisors lose this much to the fee unless admin changes it. */
export const DEFAULT_PAYPAL_FEE_PERCENT = 3;
const MAX_FEE_PERCENT = 50;

export const BANK_INSTRUCTIONS =
  'Direct Deposit is not available yet. Bank information is given to Support during advisor onboarding, not on this site. ' +
  'Once Support has received it and confirmed it, Direct Deposit will be available here. If you have already completed ' +
  'onboarding, contact Support.';

export type PayoutMethod = 'PAYPAL' | 'DIRECT_DEPOSIT';

interface PayoutFields {
  payoutMethod: string;
  paypalEmail: string | null;
  bankOnFileAt: Date | null;
}

/** The method that will actually be used: Direct Deposit only counts while Support has the bank information. */
function effectiveMethod(advisor: PayoutFields): PayoutMethod {
  return advisor.payoutMethod === 'DIRECT_DEPOSIT' && advisor.bankOnFileAt ? 'DIRECT_DEPOSIT' : 'PAYPAL';
}

/** The fee on a payment of this size, rounded to the nearest cent. */
export function paypalFee(amountCents: number, percent: number): number {
  return Math.round((amountCents * percent) / 100);
}

/** Words for the method, for the advisor's history and the admin's payment records. */
function describeMethod(advisor: PayoutFields): string {
  if (effectiveMethod(advisor) === 'DIRECT_DEPOSIT') return 'Direct deposit';
  return advisor.paypalEmail ? `PayPal: ${advisor.paypalEmail}` : 'PayPal (no email given)';
}

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Settings ───────────────────────────────────────────────────────────────

  private async readSettings(): Promise<{ defaultSharePercent: number; paypalFeePercent: number }> {
    const row = await this.prisma.setting.findUnique({ where: { key: SETTINGS_KEY } });
    let parsed: { defaultSharePercent?: unknown; paypalFeePercent?: unknown } = {};
    try {
      parsed = row ? (JSON.parse(row.value) as typeof parsed) : {};
    } catch {
      parsed = {};
    }
    const share = Number(parsed.defaultSharePercent);
    const fee = Number(parsed.paypalFeePercent);
    return {
      defaultSharePercent: parsed.defaultSharePercent != null && Number.isInteger(share) && share >= 0 && share <= 100 ? share : DEFAULT_SHARE_PERCENT,
      paypalFeePercent: parsed.paypalFeePercent != null && Number.isFinite(fee) && fee >= 0 && fee <= MAX_FEE_PERCENT ? fee : DEFAULT_PAYPAL_FEE_PERCENT,
    };
  }

  private async writeSettings(next: { defaultSharePercent: number; paypalFeePercent: number }): Promise<void> {
    const value = JSON.stringify(next);
    await this.prisma.setting.upsert({ where: { key: SETTINGS_KEY }, create: { key: SETTINGS_KEY, value }, update: { value } });
  }

  async getDefaultShare(): Promise<number> {
    return (await this.readSettings()).defaultSharePercent;
  }

  async setDefaultShare(percent: number): Promise<number> {
    if (!Number.isInteger(percent) || percent < 0 || percent > 100) throw new BadRequestException('The share must be a whole number from 0 to 100.');
    await this.writeSettings({ ...(await this.readSettings()), defaultSharePercent: percent });
    return percent;
  }

  /** The fee taken from payments made by PayPal, in percent of the amount paid. */
  async getPaypalFeePercent(): Promise<number> {
    return (await this.readSettings()).paypalFeePercent;
  }

  async setPaypalFeePercent(percent: number): Promise<number> {
    if (!Number.isFinite(percent) || percent < 0 || percent > MAX_FEE_PERCENT || Math.round(percent * 100) !== percent * 100) {
      throw new BadRequestException(`The fee must be from 0 to ${MAX_FEE_PERCENT} percent, with at most two decimal places.`);
    }
    await this.writeSettings({ ...(await this.readSettings()), paypalFeePercent: percent });
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

    const [all, week, month, paid, total, rows, payouts, defaultShare, feePercent] = await Promise.all([
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
        select: { id: true, amountCents: true, feeCents: true, method: true, reference: true, paidAt: true },
      }),
      this.getDefaultShare(),
      this.getPaypalFeePercent(),
    ]);

    const paidCents = paid._sum.amountCents ?? 0;
    const owedCents = all - paidCents;
    const method = effectiveMethod(advisor);
    return {
      timeZone: zone,
      sharePercent: advisor.sharePercent ?? defaultShare,
      method,
      paypalFeePercent: feePercent,
      summary: {
        last7DaysCents: week,
        thisMonthCents: month,
        allTimeCents: all,
        paidCents,
        owedCents,
        // What would reach them if they were paid everything owed right now by their current method.
        owedAfterFeeCents: method === 'PAYPAL' ? owedCents - paypalFee(Math.max(owedCents, 0), feePercent) : owedCents,
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
      payouts: payouts.map((payout) => ({ ...payout, netCents: payout.amountCents - payout.feeCents })),
    };
  }

  private async sumEarned(advisorId: string, since?: Date): Promise<number> {
    const sum = await this.prisma.advisorEarning.aggregate({
      where: { advisorId, ...(since ? { createdAt: { gte: since } } : {}) },
      _sum: { earnedCents: true },
    });
    return sum._sum.earnedCents ?? 0;
  }

  // ── How the advisor is paid ────────────────────────────────────────────────

  /** The advisor's payout choice and whether Direct Deposit is available to them. */
  async myDetails(userId: string) {
    return { ...this.detailsOf(await this.advisorOf(userId)), paypalFeePercent: await this.getPaypalFeePercent() };
  }

  /**
   * Switches between PayPal and Direct Deposit. Either can be chosen at any time; Direct Deposit only once Support has
   * the advisor's bank information. The PayPal email is kept when switching away, so switching back is one click.
   */
  async setMyMethod(userId: string, dto: SetPayoutMethodDto) {
    const advisor = await this.advisorOf(userId);
    const typedEmail = dto.paypalEmail?.trim().toLowerCase();
    if (typedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typedEmail)) {
      throw new BadRequestException('Enter the email address of your PayPal account.');
    }

    if (dto.method === 'DIRECT_DEPOSIT') {
      if (!advisor.bankOnFileAt) throw new BadRequestException(BANK_INSTRUCTIONS);
    } else if (!(typedEmail || advisor.paypalEmail)) {
      throw new BadRequestException('Enter the email address of your PayPal account.');
    }

    const updated = await this.prisma.advisorProfile.update({
      where: { id: advisor.id },
      data: { payoutMethod: dto.method, ...(typedEmail ? { paypalEmail: typedEmail } : {}) },
      select: ADVISOR_SELECT,
    });
    return { ...this.detailsOf(updated), paypalFeePercent: await this.getPaypalFeePercent() };
  }

  private detailsOf(advisor: PayoutFields) {
    return {
      method: effectiveMethod(advisor),
      paypalEmail: advisor.paypalEmail,
      bankOnFile: advisor.bankOnFileAt !== null,
      bankInstructions: advisor.bankOnFileAt ? null : BANK_INSTRUCTIONS,
    };
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  /** Every advisor with what they have earned, been paid and are owed, and how each wants to be paid. */
  async adminOverview() {
    const [defaultShare, advisors, earned, paid] = await Promise.all([
      this.getDefaultShare(),
      this.prisma.advisorProfile.findMany({
        select: { id: true, displayName: true, sharePercent: true, payoutMethod: true, paypalEmail: true, bankOnFileAt: true },
        orderBy: { displayName: 'asc' },
      }),
      this.prisma.advisorEarning.groupBy({ by: ['advisorId'], _sum: { earnedCents: true, chargedCents: true }, _count: { _all: true } }),
      this.prisma.advisorPayout.groupBy({ by: ['advisorId'], _sum: { amountCents: true } }),
    ]);
    const earnedBy = new Map(earned.map((row) => [row.advisorId, row]));
    const paidBy = new Map(paid.map((row) => [row.advisorId, row._sum.amountCents ?? 0]));

    const rows = advisors.map((advisor) => {
      const e = earnedBy.get(advisor.id);
      const earnedCents = e?._sum.earnedCents ?? 0;
      const paidCents = paidBy.get(advisor.id) ?? 0;
      const method = effectiveMethod(advisor);
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
        payoutMethod: method,
        payoutSummary: describeMethod(advisor),
        // Ready to be paid: PayPal needs an email; Direct Deposit needs the bank information to be on file (it is, by definition).
        payoutReady: method === 'DIRECT_DEPOSIT' || !!advisor.paypalEmail,
      };
    });
    rows.sort((a, b) => b.owedCents - a.owedCents || a.displayName.localeCompare(b.displayName));
    return {
      defaultSharePercent: defaultShare,
      paypalFeePercent: await this.getPaypalFeePercent(),
      totals: {
        chargedCents: rows.reduce((sum, r) => sum + r.chargedCents, 0),
        earnedCents: rows.reduce((sum, r) => sum + r.earnedCents, 0),
        paidCents: rows.reduce((sum, r) => sum + r.paidCents, 0),
        owedCents: rows.reduce((sum, r) => sum + r.owedCents, 0),
      },
      advisors: rows,
    };
  }

  /** One advisor for the admin: how to pay them right now, what they are owed, and recent history. */
  async adminAdvisor(advisorId: string) {
    const advisor = await this.prisma.advisorProfile.findUnique({
      where: { id: advisorId },
      select: { id: true, displayName: true, sharePercent: true, ...ADVISOR_SELECT },
    });
    if (!advisor) throw new NotFoundException('Advisor not found');

    const [defaultShare, earned, paid, payouts, recent] = await Promise.all([
      this.getDefaultShare(),
      this.sumEarned(advisorId),
      this.prisma.advisorPayout.aggregate({ where: { advisorId }, _sum: { amountCents: true } }),
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
      paypalFeePercent: await this.getPaypalFeePercent(),
      sharePercentOverride: advisor.sharePercent,
      sharePercent: advisor.sharePercent ?? defaultShare,
      earnedCents: earned,
      paidCents,
      owedCents: earned - paidCents,
      payout: {
        method: effectiveMethod(advisor),
        summary: describeMethod(advisor),
        paypalEmail: advisor.paypalEmail,
        bankOnFile: advisor.bankOnFileAt !== null,
        bankOnFileAt: advisor.bankOnFileAt,
      },
      payouts: payouts.map((payout) => ({
        id: payout.id,
        amountCents: payout.amountCents,
        feeCents: payout.feeCents,
        netCents: payout.amountCents - payout.feeCents,
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

  /**
   * Support has (or no longer has) the advisor's bank information from onboarding. Marking it received lets the advisor
   * choose Direct Deposit; clearing it puts an advisor who had chosen Direct Deposit back on PayPal.
   */
  async setBankOnFile(advisorId: string, onFile: boolean) {
    const advisor = await this.prisma.advisorProfile.findUnique({ where: { id: advisorId }, select: { id: true, payoutMethod: true } });
    if (!advisor) throw new NotFoundException('Advisor not found');
    await this.prisma.advisorProfile.update({
      where: { id: advisorId },
      data: onFile ? { bankOnFileAt: new Date() } : { bankOnFileAt: null, ...(advisor.payoutMethod === 'DIRECT_DEPOSIT' ? { payoutMethod: 'PAYPAL' } : {}) },
    });
    return this.adminAdvisor(advisorId);
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

  /** Records a payment made to an advisor, along with how they were being paid at the time. It cannot be more than they are owed. */
  async recordPayout(adminId: string, advisorId: string, dto: RecordPayoutDto) {
    const feePercent = await this.getPaypalFeePercent();
    let paidAt = new Date();
    if (dto.paidAt) {
      paidAt = new Date(dto.paidAt);
      if (Number.isNaN(paidAt.getTime())) throw new BadRequestException('The payment date is not valid.');
      if (paidAt.getTime() > Date.now() + 24 * 60 * 60 * 1000) throw new BadRequestException('The payment date cannot be in the future.');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const advisor = await tx.advisorProfile.findUnique({ where: { id: advisorId }, select: ADVISOR_SELECT_WITH_ID });
        if (!advisor) throw new NotFoundException('Advisor not found');
        const [earned, paid] = await Promise.all([
          tx.advisorEarning.aggregate({ where: { advisorId }, _sum: { earnedCents: true } }),
          tx.advisorPayout.aggregate({ where: { advisorId }, _sum: { amountCents: true } }),
        ]);
        const owed = (earned._sum.earnedCents ?? 0) - (paid._sum.amountCents ?? 0);
        if (dto.amountCents > owed) {
          throw new BadRequestException(`This advisor is owed $${(Math.max(owed, 0) / 100).toFixed(2)}, so you cannot record a payment of $${(dto.amountCents / 100).toFixed(2)}.`);
        }
        // The fee comes out of the payment: the advisor is owed less by the full amount, and receives it less the fee.
        const feeCents = effectiveMethod(advisor) === 'PAYPAL' ? paypalFee(dto.amountCents, feePercent) : 0;
        const created = await tx.advisorPayout.create({
          data: {
            advisorId,
            amountCents: dto.amountCents,
            feeCents,
            method: describeMethod(advisor),
            reference: dto.reference?.trim() || null,
            note: dto.note?.trim() || null,
            paidAt,
            createdByUserId: adminId,
          },
          select: { id: true, amountCents: true, feeCents: true, method: true, reference: true, note: true, paidAt: true },
        });
        return { ...created, netCents: created.amountCents - created.feeCents };
      },
      // Serializable, so two payments recorded at the same moment cannot together exceed what is owed.
      { isolationLevel: 'Serializable' },
    );
  }

  /** Removes a payment that was recorded by mistake; the amount goes back to what the advisor is owed. */
  async deletePayout(payoutId: string) {
    const payout = await this.prisma.advisorPayout.findUnique({ where: { id: payoutId }, select: { id: true, advisorId: true, amountCents: true } });
    if (!payout) throw new NotFoundException('Payment not found');
    await this.prisma.advisorPayout.delete({ where: { id: payoutId } });
    return payout;
  }

  private async advisorOf(userId: string) {
    const advisor = await this.prisma.advisorProfile.findUnique({
      where: { userId },
      select: { id: true, sharePercent: true, ...ADVISOR_SELECT },
    });
    if (!advisor) throw new NotFoundException('Advisor profile not found');
    return advisor;
  }
}

const ADVISOR_SELECT = { payoutMethod: true, paypalEmail: true, bankOnFileAt: true } as const;
const ADVISOR_SELECT_WITH_ID = { id: true, ...ADVISOR_SELECT } as const;

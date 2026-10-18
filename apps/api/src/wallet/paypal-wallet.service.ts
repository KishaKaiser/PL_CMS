import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PaypalService } from '../checkout/paypal.service';
import { PrismaService } from '../prisma/prisma.service';

/** The smallest and largest amount a client can add in one top-up, in cents. */
export const MIN_TOP_UP_CENTS = 500;
export const MAX_TOP_UP_CENTS = 10_000;

/** The most that can be charged to one client's wallet in 24 hours, unless an admin sets another figure. */
const DEFAULT_DAILY_CAP_DOLLARS = 500;
const MIN_DAILY_CAP_DOLLARS = 5;
const MAX_DAILY_CAP_DOLLARS = 10_000;
const TELEPHONY_SETTINGS_KEY = 'telephony_settings';

const DAY_MS = 24 * 60 * 60_000;
const SETUP_VALID_MS = 60 * 60_000;

export type TopUpResult =
  | { ok: true; amountCents: number; balanceCents: number }
  | { ok: false; reason: 'amount' | 'no-wallet' | 'limit' | 'declined' | 'error'; remainingCents?: number };

@Injectable()
export class PaypalWalletService {
  private readonly logger = new Logger(PaypalWalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paypal: PaypalService,
  ) {}

  // ── The client's saved wallet ──────────────────────────────────────────────

  async status(userId: string) {
    const [wallet, used, capCents] = await Promise.all([
      this.prisma.paypalWallet.findUnique({ where: { userId }, select: { payerEmail: true } }),
      this.usedInLastDay(userId),
      this.dailyCapCents(),
    ]);
    return {
      connected: wallet !== null,
      payerEmail: wallet?.payerEmail ? maskEmail(wallet.payerEmail) : null,
      minTopUpCents: MIN_TOP_UP_CENTS,
      maxTopUpCents: MAX_TOP_UP_CENTS,
      dailyCapCents: capCents,
      remainingTodayCents: Math.max(0, capCents - used),
    };
  }

  /** Starts connecting a PayPal wallet: returns the PayPal page the client approves it on. */
  async startConnect(userId: string, returnUrl: string) {
    await this.prisma.paypalWalletSetup.deleteMany({ where: { userId, createdAt: { lt: new Date(Date.now() - SETUP_VALID_MS) } } });
    const { setupTokenId, approveUrl } = await this.paypal.createWalletSetup(returnUrl);
    await this.prisma.paypalWalletSetup.create({ data: { userId, setupTokenId } });
    return { approveUrl };
  }

  /** The client came back from PayPal: turn what they approved into the wallet we can charge later. */
  async completeConnect(userId: string) {
    const setup = await this.prisma.paypalWalletSetup.findFirst({
      where: { userId, createdAt: { gt: new Date(Date.now() - SETUP_VALID_MS) } },
      orderBy: { createdAt: 'desc' },
    });
    if (!setup) throw new BadRequestException('There is no PayPal connection in progress. Please start again from your account page.');

    let token: { vaultId: string; payerEmail: string | null };
    try {
      token = await this.paypal.createPaymentToken(setup.setupTokenId);
    } catch (error) {
      await this.prisma.paypalWalletSetup.deleteMany({ where: { userId } });
      throw new BadRequestException(error instanceof Error ? error.message : 'The PayPal connection was not completed.');
    }

    const existing = await this.prisma.paypalWallet.findUnique({ where: { userId } });
    await this.prisma.paypalWallet.upsert({
      where: { userId },
      create: { userId, vaultId: token.vaultId, payerEmail: token.payerEmail },
      update: { vaultId: token.vaultId, payerEmail: token.payerEmail },
    });
    await this.prisma.paypalWalletSetup.deleteMany({ where: { userId } });
    if (existing && existing.vaultId !== token.vaultId) await this.paypal.deletePaymentToken(existing.vaultId);

    return this.status(userId);
  }

  async disconnect(userId: string) {
    const wallet = await this.prisma.paypalWallet.findUnique({ where: { userId } });
    if (wallet) {
      await this.prisma.paypalWallet.delete({ where: { userId } });
      await this.paypal.deletePaymentToken(wallet.vaultId);
    }
    return this.status(userId);
  }

  // ── Adding money ───────────────────────────────────────────────────────────

  /** Whether this client should be offered a top-up now: they have a wallet and room left under the daily limit. */
  async canOffer(userId: string): Promise<boolean> {
    const wallet = await this.prisma.paypalWallet.findUnique({ where: { userId }, select: { id: true } });
    if (!wallet) return false;
    const [used, cap] = await Promise.all([this.usedInLastDay(userId), this.dailyCapCents()]);
    return cap - used >= MIN_TOP_UP_CENTS;
  }

  /**
   * Charges the client's saved wallet and credits their balance. Never charges more than the limits allow, and
   * credits exactly once for each charge.
   */
  async topUp(userId: string, amountCents: number, callSessionId?: string): Promise<TopUpResult> {
    if (!Number.isInteger(amountCents) || amountCents < MIN_TOP_UP_CENTS || amountCents > MAX_TOP_UP_CENTS) {
      return { ok: false, reason: 'amount' };
    }

    const [wallet, profile] = await Promise.all([
      this.prisma.paypalWallet.findUnique({ where: { userId } }),
      this.prisma.clientProfile.findUnique({ where: { userId }, select: { id: true } }),
    ]);
    if (!wallet || !profile) return { ok: false, reason: 'no-wallet' };

    const cap = await this.dailyCapCents();
    const used = await this.usedInLastDay(userId);
    if (used + amountCents > cap) return { ok: false, reason: 'limit', remainingCents: Math.max(0, cap - used) };

    const record = await this.prisma.walletTopUp.create({
      data: { userId, amountCents, source: 'CALL', ...(callSessionId ? { callSessionId } : {}) },
    });

    // Two top-ups started at the same moment could both pass the check above; look again now that this one is counted.
    const usedWithThis = await this.usedInLastDay(userId);
    if (usedWithThis > cap) {
      await this.prisma.walletTopUp.update({ where: { id: record.id }, data: { status: 'FAILED', failureReason: 'Daily limit reached' } });
      return { ok: false, reason: 'limit', remainingCents: Math.max(0, cap - (usedWithThis - amountCents)) };
    }

    const charge = await this.paypal.chargeSavedWallet({
      vaultId: wallet.vaultId,
      amountCents,
      requestId: record.id,
      description: 'Wallet top-up for phone readings',
    });
    if (!charge.ok) {
      await this.prisma.walletTopUp.update({ where: { id: record.id }, data: { status: 'FAILED', failureReason: charge.detail.slice(0, 500) } });
      return { ok: false, reason: charge.reason === 'declined' ? 'declined' : 'error' };
    }

    // The money has been taken. Record the capture first so it can never be lost, then credit the balance.
    await this.prisma.walletTopUp.update({
      where: { id: record.id },
      data: { paypalOrderId: charge.orderId, paypalCaptureId: charge.captureId },
    });

    let balanceCents: number | null = null;
    for (let attempt = 1; attempt <= 2 && balanceCents === null; attempt++) {
      try {
        balanceCents = await this.credit(record.id, userId, profile.id, amountCents);
      } catch (error) {
        this.logger.error(
          `Charged ${amountCents} cents (PayPal capture ${charge.captureId}, top-up ${record.id}) but could not credit the wallet on attempt ${attempt}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
    if (balanceCents === null) return { ok: false, reason: 'error' };

    this.logger.log(`Added ${amountCents} cents to the wallet of user ${userId} from their PayPal wallet (top-up ${record.id})`);
    return { ok: true, amountCents, balanceCents };
  }

  /** Marks the top-up completed and credits the balance in one step; only the first call for a top-up credits. */
  private async credit(topUpId: string, userId: string, clientId: string, amountCents: number): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.walletTopUp.updateMany({ where: { id: topUpId, status: 'PENDING' }, data: { status: 'COMPLETED' } });
      if (claim.count === 1) {
        await tx.clientProfile.update({ where: { id: clientId }, data: { balanceCents: { increment: amountCents } } });
        await tx.walletTransaction.create({
          data: {
            userId,
            type: 'CREDIT',
            amount: amountCents / 100,
            description: `Added $${(amountCents / 100).toFixed(2)} to wallet from saved PayPal wallet (top-up ${topUpId})`,
          },
        });
      }
      const profile = await tx.clientProfile.findUnique({ where: { id: clientId }, select: { balanceCents: true } });
      return profile?.balanceCents ?? 0;
    });
  }

  // ── Limits ─────────────────────────────────────────────────────────────────

  /** The most that can be charged to one client in 24 hours (Admin > Settings > Telephony). */
  async dailyCapCents(): Promise<number> {
    try {
      const setting = await this.prisma.setting.findUnique({ where: { key: TELEPHONY_SETTINGS_KEY } });
      if (setting) {
        const raw = (JSON.parse(setting.value) as { walletTopUpDailyCapDollars?: unknown }).walletTopUpDailyCapDollars;
        const dollars = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
        if (Number.isFinite(dollars)) {
          return Math.round(Math.min(MAX_DAILY_CAP_DOLLARS, Math.max(MIN_DAILY_CAP_DOLLARS, dollars)) * 100);
        }
      }
    } catch {
      // fall through to the default
    }
    return DEFAULT_DAILY_CAP_DOLLARS * 100;
  }

  private async usedInLastDay(userId: string): Promise<number> {
    const sum = await this.prisma.walletTopUp.aggregate({
      where: { userId, status: { in: ['PENDING', 'COMPLETED'] }, createdAt: { gt: new Date(Date.now() - DAY_MS) } },
      _sum: { amountCents: true },
    });
    return sum._sum.amountCents ?? 0;
  }
}

/** "jane.doe@gmail.com" becomes "j***@gmail.com". */
export function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!name || !domain) return '***';
  return `${name.charAt(0)}***@${domain}`;
}

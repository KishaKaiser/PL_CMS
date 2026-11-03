import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@pl-cms/db';
import { ipKey } from '../common/client-ip';
import { PaypalService } from '../checkout/paypal.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Free call minutes. A grant is a number of minutes given to a client; while a call is billed, free minutes are
 * used first and the wallet is only charged once they run out.
 *
 *  - An advisor's gift (1, 3 or 5 minutes) can only be used on calls with that advisor, and lapses after 30 days.
 *  - An admin gift, or the new customer promotion, can be used with any advisor.
 *
 * Free minutes never touch the wallet balance, so they create no wallet revenue and no refund. The new customer promotion
 * can cost a small price (99 cents by default): it is paid through PayPal, once per client and once per internet address,
 * so that each promotion goes to a real customer and not to someone signing up again and again.
 */

export const ADVISOR_GIFT_MINUTES = [1, 3, 5];
const ADVISOR_GIFT_EXPIRY_DAYS = 30;
const MAX_ADMIN_MINUTES = 600;
const MAX_NOTE_LENGTH = 200;
export const WELCOME_PROMO_KEY = 'welcome';
const PROMO_SETTING_KEY = 'welcome_promo';
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PROMO_PRICE_CENTS = 10_000;
/** How long a promotion waits for its PayPal payment before the address and the client are free to try again. */
const PENDING_CLAIM_MS = 30 * 60 * 1000;

type Db = PrismaService | Prisma.TransactionClient;

export interface WelcomePromo {
  enabled: boolean;
  minutes: number;
  /** Days the minutes last once granted; null = they never expire. */
  expiresInDays: number | null;
  /** What the client pays for the promotional minutes, in cents. 0 = they are free and granted at sign-up. */
  priceCents: number;
}

const DEFAULT_PROMO: WelcomePromo = { enabled: false, minutes: 5, expiresInDays: 30, priceCents: 99 };

/** What the client is shown about the new customer promotion. */
export interface PromoOffer {
  /** unavailable: no offer for this client. available: can be claimed. claimed: already has it. blocked: this internet connection already used it. */
  status: 'unavailable' | 'available' | 'claimed' | 'blocked';
  priceCents: number;
  minutes: number;
  expiresInDays: number | null;
  message: string | null;
}

const BLOCKED_MESSAGE = 'This offer has already been claimed from your internet connection. It can only be claimed once from each connection.';

/** Grants that can be used right now on a call with this advisor. */
function usableWhere(clientId: string, advisorId: string, now: Date): Prisma.FreeMinuteGrantWhereInput {
  return {
    clientId,
    remaining: { gt: 0 },
    AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, { OR: [{ advisorId: null }, { advisorId }] }],
  };
}

async function readPromo(db: Db): Promise<WelcomePromo> {
  const row = await db.setting.findUnique({ where: { key: PROMO_SETTING_KEY } });
  if (!row) return DEFAULT_PROMO;
  try {
    const parsed = JSON.parse(row.value) as Partial<WelcomePromo>;
    const minutes = Number(parsed.minutes);
    const days = parsed.expiresInDays;
    return {
      enabled: parsed.enabled === true,
      minutes: Number.isInteger(minutes) && minutes > 0 ? Math.min(minutes, MAX_ADMIN_MINUTES) : DEFAULT_PROMO.minutes,
      expiresInDays: typeof days === 'number' && Number.isInteger(days) && days > 0 ? days : null,
      // A promotion saved before it had a price stays free.
      priceCents: Number.isInteger(parsed.priceCents) && (parsed.priceCents as number) >= 0 ? Math.min(parsed.priceCents as number, MAX_PROMO_PRICE_CENTS) : 0,
    };
  } catch {
    return DEFAULT_PROMO;
  }
}

/**
 * Gives a brand-new client the promotional minutes when the promotion is free. A promotion with a price is claimed (and paid
 * for) by the client instead. With an address, only the first client from that internet connection gets them. Safe to call
 * more than once for the same client (the promotion key is unique per client). Meant to run inside the transaction that
 * creates the profile; an account an admin creates passes no address and is not limited.
 */
export async function grantWelcomePromo(db: Db, clientId: string, ip?: string): Promise<void> {
  const promo = await readPromo(db);
  if (!promo.enabled || promo.priceCents > 0) return;
  if (ip) {
    const claimed = await db.promoClaim.createMany({
      data: [
        {
          clientId,
          status: 'PAID',
          priceCents: 0,
          minutes: promo.minutes,
          ipAddress: ip,
          ipKey: ipKey(ip),
          clientKey: clientId,
          paidAt: new Date(),
        },
      ],
      skipDuplicates: true,
    });
    // Someone from this internet connection already has the promotion.
    if (claimed.count === 0) return;
  }
  await db.freeMinuteGrant.createMany({
    data: [promoGrant(clientId, promo.minutes, promo.expiresInDays)],
    skipDuplicates: true,
  });
}

function promoGrant(clientId: string, minutes: number, expiresInDays: number | null) {
  return {
    clientId,
    minutes,
    remaining: minutes,
    source: 'PROMO',
    promoKey: WELCOME_PROMO_KEY,
    note: 'New customer promotion',
    expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * DAY_MS) : null,
  };
}

@Injectable()
export class FreeMinutesService {
  private readonly logger = new Logger(FreeMinutesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paypal: PaypalService,
    private readonly config: ConfigService,
  ) {}

  // ── Using free minutes (billing) ───────────────────────────────────────────

  /** Free minutes the client could use on a call with this advisor right now. */
  async availableMinutes(clientId: string, advisorId: string, db: Db = this.prisma): Promise<number> {
    const total = await db.freeMinuteGrant.aggregate({
      _sum: { remaining: true },
      where: usableWhere(clientId, advisorId, new Date()),
    });
    return total._sum.remaining ?? 0;
  }

  /** Whether the wallet and any free minutes together cover this many minutes with the advisor. */
  async canAfford(client: { id: string; balanceCents: number }, advisorId: string, rateCents: number, minutes: number): Promise<boolean> {
    if (client.balanceCents >= rateCents * minutes) return true;
    const free = await this.availableMinutes(client.id, advisorId);
    return client.balanceCents >= rateCents * Math.max(0, minutes - free);
  }

  /** Uses up one free minute (the advisor's own gifts first, then the ones expiring soonest). False if there are none. */
  async consumeOne(db: Db, clientId: string, advisorId: string): Promise<boolean> {
    const grants = await db.freeMinuteGrant.findMany({
      where: usableWhere(clientId, advisorId, new Date()),
      select: { id: true, advisorId: true, expiresAt: true, createdAt: true },
      take: 50,
    });
    grants.sort((a, b) => {
      if (!!a.advisorId !== !!b.advisorId) return a.advisorId ? -1 : 1;
      const ea = a.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const eb = b.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return ea - eb || a.createdAt.getTime() - b.createdAt.getTime();
    });
    for (const grant of grants) {
      const taken = await db.freeMinuteGrant.updateMany({
        where: { id: grant.id, remaining: { gt: 0 } },
        data: { remaining: { decrement: 1 } },
      });
      if (taken.count === 1) return true;
    }
    return false;
  }

  // ── The client's view ──────────────────────────────────────────────────────

  /** What the signed-in client has: minutes for any advisor and minutes tied to a particular advisor. */
  async mine(userId: string) {
    const client = await this.prisma.clientProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!client) return { total: 0, anyAdvisor: 0, advisors: [], nextExpiry: null };

    const grants = await this.prisma.freeMinuteGrant.findMany({
      where: { clientId: client.id, remaining: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      select: { remaining: true, advisorId: true, expiresAt: true, advisor: { select: { displayName: true, slug: true } } },
    });

    let anyAdvisor = 0;
    let nextExpiry: Date | null = null;
    const perAdvisor = new Map<string, { advisorId: string; name: string; slug: string | null; minutes: number }>();
    for (const grant of grants) {
      if (grant.expiresAt && (!nextExpiry || grant.expiresAt < nextExpiry)) nextExpiry = grant.expiresAt;
      if (grant.advisorId && grant.advisor) {
        const entry = perAdvisor.get(grant.advisorId) ?? {
          advisorId: grant.advisorId,
          name: grant.advisor.displayName,
          slug: grant.advisor.slug ?? null,
          minutes: 0,
        };
        entry.minutes += grant.remaining;
        perAdvisor.set(grant.advisorId, entry);
      } else {
        anyAdvisor += grant.remaining;
      }
    }
    const advisors = [...perAdvisor.values()].sort((a, b) => b.minutes - a.minutes);
    return {
      total: anyAdvisor + advisors.reduce((sum, a) => sum + a.minutes, 0),
      anyAdvisor,
      advisors,
      nextExpiry,
    };
  }

  // ── Advisors giving minutes ────────────────────────────────────────────────

  /** An advisor gives a client they have spoken with 1, 3 or 5 free minutes, usable only with that advisor. */
  async giveAsAdvisor(userId: string, dto: { clientUserId: string; minutes: number }) {
    if (!ADVISOR_GIFT_MINUTES.includes(dto.minutes)) {
      throw new BadRequestException(`You can send ${ADVISOR_GIFT_MINUTES.join(', ')} free minutes at a time.`);
    }
    const advisor = await this.prisma.advisorProfile.findUnique({ where: { userId }, select: { id: true, displayName: true } });
    if (!advisor) throw new ForbiddenException('Only advisors can send free minutes.');

    const client = await this.prisma.clientProfile.findUnique({ where: { userId: dto.clientUserId }, select: { id: true } });
    if (!client || !(await this.hasContacted(client.id, advisor.id))) {
      throw new ForbiddenException('You can send free minutes to clients who have contacted you.');
    }

    const grant = await this.prisma.freeMinuteGrant.create({
      data: {
        clientId: client.id,
        advisorId: advisor.id,
        minutes: dto.minutes,
        remaining: dto.minutes,
        source: 'ADVISOR',
        grantedByUserId: userId,
        expiresAt: new Date(Date.now() + ADVISOR_GIFT_EXPIRY_DAYS * DAY_MS),
      },
    });

    const label = `${dto.minutes} free minute${dto.minutes === 1 ? '' : 's'}`;
    await this.prisma.message
      .create({
        data: {
          senderId: userId,
          recipientId: dto.clientUserId,
          subject: 'You received free minutes',
          body: `${advisor.displayName} sent you ${label} to use on a call with them. They are yours for ${ADVISOR_GIFT_EXPIRY_DAYS} days.`,
        },
      })
      .catch(() => undefined);

    return { id: grant.id, minutes: dto.minutes };
  }

  /** The most recent gifts an advisor has sent. */
  async sentByAdvisor(userId: string) {
    const rows = await this.prisma.freeMinuteGrant.findMany({
      where: { grantedByUserId: userId, source: 'ADVISOR' },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: { id: true, minutes: true, remaining: true, createdAt: true, client: { select: { user: { select: { username: true, name: true } } } } },
    });
    return rows.map((row) => ({
      id: row.id,
      minutes: row.minutes,
      remaining: row.remaining,
      createdAt: row.createdAt,
      to: row.client.user.username ?? row.client.user.name,
    }));
  }

  private async hasContacted(clientId: string, advisorId: string): Promise<boolean> {
    const [call, appointment, spot] = await Promise.all([
      this.prisma.callSession.findFirst({ where: { clientId, advisorId, connectedAt: { not: null } }, select: { id: true } }),
      this.prisma.appointment.findFirst({ where: { clientId, advisorId }, select: { id: true } }),
      this.prisma.queueAssignment.findFirst({ where: { clientId, queue: { advisorId } }, select: { id: true } }),
    ]);
    return !!(call || appointment || spot);
  }

  // ── The new customer promotion (paid) ──────────────────────────────────────

  /** What this client can do about the new customer promotion right now. */
  async offerFor(userId: string, ip: string | undefined): Promise<PromoOffer> {
    const promo = await readPromo(this.prisma);
    const base = { priceCents: promo.priceCents, minutes: promo.minutes, expiresInDays: promo.expiresInDays };
    const unavailable: PromoOffer = { ...base, status: 'unavailable', message: null };
    if (!promo.enabled || promo.priceCents <= 0) return unavailable;

    const client = await this.prisma.clientProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!client) return unavailable;
    await this.expireStaleClaims();

    const problem = await this.claimProblem(userId, client.id, ip);
    if (!problem) return { ...base, status: 'available', message: null };
    return { ...base, status: problem.status, message: problem.message };
  }

  /**
   * Starts a claim: checks the client may have the promotion, holds their place (one claim per client and per internet
   * address, enforced by the database) and creates the PayPal payment. Returns the PayPal page they approve it on.
   */
  async startClaim(userId: string, ip: string | undefined, returnOrigin: string) {
    const promo = await readPromo(this.prisma);
    if (!promo.enabled || promo.priceCents <= 0) throw new BadRequestException('This offer is not available right now.');
    if (!ip) throw new BadRequestException('We could not tell where this request came from, so the offer cannot be claimed. Please try again.');
    const client = await this.prisma.clientProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!client) throw new ForbiddenException('Only clients can claim this offer.');

    await this.expireStaleClaims();
    const problem = await this.claimProblem(userId, client.id, ip);
    if (problem) throw new ConflictException(problem.message);

    // A claim this client left waiting earlier is replaced by the new one.
    await this.releaseWhere({ clientId: client.id, status: 'PENDING' }, 'REPLACED');

    let claim: { id: string };
    try {
      claim = await this.prisma.promoClaim.create({
        data: {
          clientId: client.id,
          status: 'PENDING',
          priceCents: promo.priceCents,
          minutes: promo.minutes,
          ipAddress: ip,
          ipKey: ipKey(ip),
          clientKey: client.id,
        },
        select: { id: true },
      });
    } catch (error) {
      // Another sign-up from this connection got in first.
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException(BLOCKED_MESSAGE);
      throw error;
    }

    try {
      const { paypalOrderId, approvalUrl } = await this.paypal.createOrder(
        claim.id,
        (promo.priceCents / 100).toFixed(2),
        'USD',
        `${returnOrigin}/client/promo`,
        `${returnOrigin}/client/promo?cancelled=1`,
      );
      await this.prisma.promoClaim.update({ where: { id: claim.id }, data: { paypalOrderId } });
      return { approvalUrl };
    } catch (error) {
      await this.releaseWhere({ id: claim.id }, 'FAILED');
      this.logger.error(`Could not start the promotion payment: ${error instanceof Error ? error.message : String(error)}`);
      throw new BadRequestException('We could not reach PayPal to start the payment. Please try again in a moment.');
    }
  }

  /** The client came back from PayPal: take the payment and, once PayPal confirms it, grant the minutes. */
  async completeClaim(userId: string, paypalOrderId: string) {
    const claim = await this.ownClaim(userId, paypalOrderId);
    if (claim.status === 'PAID') return { status: 'paid' as const, minutes: claim.minutes };
    if (claim.status !== 'PENDING') throw new BadRequestException('This offer is no longer waiting for payment. You can start it again from your account.');

    const notConfirmed = 'PayPal has not confirmed the payment yet. If you approved it, wait a moment and open this page again.';
    let payerEmail: string | undefined;
    let captureId: string | undefined;
    let completed = false;
    try {
      const captured = await this.paypal.captureOrder(paypalOrderId);
      completed = captured.status === 'COMPLETED';
      payerEmail = captured.payerEmail;
      captureId = captured.captureId;
    } catch (error) {
      // The capture may have gone through on an earlier visit to this page: PayPal then refuses a second one. Ask it.
      completed = (await this.paypal.getOrderStatus(paypalOrderId).catch(() => null)) === 'COMPLETED';
      if (!completed) {
        this.logger.warn(`Promotion capture failed for ${paypalOrderId}: ${error instanceof Error ? error.message : String(error)}`);
        throw new BadRequestException(notConfirmed);
      }
    }
    if (!completed) throw new BadRequestException(notConfirmed);

    const promo = await readPromo(this.prisma);
    await this.prisma.$transaction(async (tx) => {
      await tx.promoClaim.updateMany({
        where: { id: claim.id, status: 'PENDING' },
        data: { status: 'PAID', paidAt: new Date(), captureId: captureId ?? null, payerEmail: payerEmail ?? null },
      });
      await tx.freeMinuteGrant.createMany({
        data: [promoGrant(claim.clientId, claim.minutes, promo.expiresInDays)],
        skipDuplicates: true,
      });
    });
    return { status: 'paid' as const, minutes: claim.minutes };
  }

  /** The client left PayPal without paying: free their place so they can try again. */
  async cancelClaim(userId: string, paypalOrderId: string) {
    const claim = await this.ownClaim(userId, paypalOrderId);
    if (claim.status === 'PENDING') await this.releaseWhere({ id: claim.id, status: 'PENDING' }, 'CANCELLED');
    return { ok: true };
  }

  private async ownClaim(userId: string, paypalOrderId: string) {
    const claim = await this.prisma.promoClaim.findUnique({
      where: { paypalOrderId },
      select: { id: true, clientId: true, status: true, minutes: true, client: { select: { userId: true } } },
    });
    if (!claim || claim.client.userId !== userId) throw new NotFoundException('We could not find that payment.');
    return claim;
  }

  /** Why this client cannot claim the promotion, or null when they can. */
  private async claimProblem(
    userId: string,
    clientId: string,
    ip: string | undefined,
  ): Promise<{ status: 'claimed' | 'unavailable' | 'blocked'; message: string } | null> {
    const [paidClaim, grant, paidMinutes] = await Promise.all([
      this.prisma.promoClaim.findFirst({ where: { clientId, status: 'PAID' }, select: { id: true } }),
      this.prisma.freeMinuteGrant.findFirst({ where: { clientId, promoKey: WELCOME_PROMO_KEY }, select: { id: true } }),
      this.prisma.walletTransaction.count({ where: { userId, type: 'DEBIT', amount: { gt: 0 } } }),
    ]);
    if (paidClaim || grant) return { status: 'claimed', message: 'You have already claimed this offer.' };
    if (paidMinutes > 0) return { status: 'unavailable', message: 'This offer is for new customers.' };
    if (ip) {
      const taken = await this.prisma.promoClaim.findFirst({ where: { ipKey: ipKey(ip), NOT: { clientId } }, select: { id: true } });
      if (taken) return { status: 'blocked', message: BLOCKED_MESSAGE };
    }
    return null;
  }

  /** Claims that never got paid free their address and client after a while. */
  private async expireStaleClaims() {
    await this.releaseWhere({ status: 'PENDING', createdAt: { lt: new Date(Date.now() - PENDING_CLAIM_MS) } }, 'EXPIRED');
  }

  private async releaseWhere(where: Prisma.PromoClaimWhereInput, status: string) {
    await this.prisma.promoClaim.updateMany({ where, data: { status, ipKey: null, clientKey: null } });
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  /** Gives free minutes (usable with any advisor) to one client or to every client. */
  async giveAsAdmin(
    adminId: string,
    dto: { audience: 'CLIENT' | 'ALL_CLIENTS'; clientUserId?: string; minutes: number; expiresInDays?: number | null; note?: string },
  ) {
    if (!Number.isInteger(dto.minutes) || dto.minutes < 1 || dto.minutes > MAX_ADMIN_MINUTES) {
      throw new BadRequestException(`Choose between 1 and ${MAX_ADMIN_MINUTES} minutes.`);
    }
    if (dto.expiresInDays != null && (!Number.isInteger(dto.expiresInDays) || dto.expiresInDays < 1 || dto.expiresInDays > 365)) {
      throw new BadRequestException('Minutes can last between 1 and 365 days, or never expire.');
    }
    const note = dto.note?.trim().slice(0, MAX_NOTE_LENGTH) || null;
    const expiresAt = dto.expiresInDays ? new Date(Date.now() + dto.expiresInDays * DAY_MS) : null;

    let clients: { id: string; userId: string }[];
    if (dto.audience === 'ALL_CLIENTS') {
      clients = await this.prisma.clientProfile.findMany({ select: { id: true, userId: true } });
    } else {
      if (!dto.clientUserId) throw new BadRequestException('Choose a client.');
      const one = await this.prisma.clientProfile.findUnique({ where: { userId: dto.clientUserId }, select: { id: true, userId: true } });
      if (!one) throw new NotFoundException('Client not found');
      clients = [one];
    }
    if (clients.length === 0) return { clients: 0, minutes: dto.minutes };

    const label = `${dto.minutes} free minute${dto.minutes === 1 ? '' : 's'}`;
    const expiry = dto.expiresInDays ? ` They last ${dto.expiresInDays} day${dto.expiresInDays === 1 ? '' : 's'}.` : '';
    for (let i = 0; i < clients.length; i += 500) {
      const chunk = clients.slice(i, i + 500);
      await this.prisma.$transaction([
        this.prisma.freeMinuteGrant.createMany({
          data: chunk.map((c) => ({
            clientId: c.id,
            minutes: dto.minutes,
            remaining: dto.minutes,
            source: 'ADMIN',
            grantedByUserId: adminId,
            note,
            expiresAt,
          })),
        }),
        // The notice sits in the client's inbox only; it is not kept in the staff sent folder.
        this.prisma.message.createMany({
          data: chunk.map((c) => ({
            senderId: adminId,
            recipientId: c.userId,
            subject: 'You received free minutes',
            body: `You have ${label} to use on a call with any advisor.${expiry}${note ? ` ${note}` : ''}`,
            senderFolder: 'PURGED',
          })),
        }),
      ]);
    }
    return { clients: clients.length, minutes: dto.minutes };
  }

  /** The latest promotion claims, with the address each came from. */
  async claims() {
    const rows = await this.prisma.promoClaim.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        priceCents: true,
        minutes: true,
        ipAddress: true,
        ipKey: true,
        payerEmail: true,
        createdAt: true,
        paidAt: true,
        client: { select: { user: { select: { username: true, name: true } } } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      priceCents: row.priceCents,
      minutes: row.minutes,
      ipAddress: row.ipAddress,
      payerEmail: row.payerEmail,
      createdAt: row.createdAt,
      paidAt: row.paidAt,
      // Still holding its internet connection: that connection cannot claim again until it is released.
      holdingAddress: row.ipKey !== null,
      client: row.client.user.username ?? row.client.user.name,
    }));
  }

  /** Lets an internet connection claim the promotion again (a family sharing one, or while testing). The client keeps their minutes. */
  async releaseAddress(claimId: string) {
    const claim = await this.prisma.promoClaim.findUnique({ where: { id: claimId }, select: { id: true } });
    if (!claim) throw new NotFoundException('Claim not found');
    await this.prisma.promoClaim.update({ where: { id: claimId }, data: { ipKey: null } });
    return { ok: true };
  }

  async getPromo(): Promise<WelcomePromo> {
    return readPromo(this.prisma);
  }

  async setPromo(input: { enabled: boolean; minutes: number; expiresInDays?: number | null; priceCents?: number }): Promise<WelcomePromo> {
    if (!Number.isInteger(input.minutes) || input.minutes < 1 || input.minutes > MAX_ADMIN_MINUTES) {
      throw new BadRequestException(`Choose between 1 and ${MAX_ADMIN_MINUTES} minutes.`);
    }
    if (input.expiresInDays != null && (!Number.isInteger(input.expiresInDays) || input.expiresInDays < 1 || input.expiresInDays > 365)) {
      throw new BadRequestException('Minutes can last between 1 and 365 days, or never expire.');
    }
    if (input.priceCents != null && (!Number.isInteger(input.priceCents) || input.priceCents < 0 || input.priceCents > MAX_PROMO_PRICE_CENTS)) {
      throw new BadRequestException('The price must be between $0.00 (free) and $100.00.');
    }
    const priceCents = input.priceCents ?? (await readPromo(this.prisma)).priceCents;
    const promo: WelcomePromo = { enabled: input.enabled, minutes: input.minutes, expiresInDays: input.expiresInDays ?? null, priceCents };
    const value = JSON.stringify(promo);
    await this.prisma.setting.upsert({
      where: { key: PROMO_SETTING_KEY },
      create: { key: PROMO_SETTING_KEY, value },
      update: { value },
    });
    return promo;
  }

  /** Totals by where the minutes came from, and the latest admin and promotion grants. */
  async overview() {
    const [bySource, recent, promoClients] = await Promise.all([
      this.prisma.freeMinuteGrant.groupBy({
        by: ['source'],
        _sum: { minutes: true, remaining: true },
        _count: { _all: true },
      }),
      this.prisma.freeMinuteGrant.findMany({
        where: { source: { in: ['ADMIN', 'PROMO'] } },
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: {
          id: true,
          source: true,
          minutes: true,
          remaining: true,
          note: true,
          expiresAt: true,
          createdAt: true,
          client: { select: { user: { select: { username: true, name: true } } } },
        },
      }),
      this.prisma.freeMinuteGrant.count({ where: { source: 'PROMO' } }),
    ]);
    return {
      totals: bySource.map((row) => ({
        source: row.source,
        grants: row._count._all,
        minutesGiven: row._sum.minutes ?? 0,
        minutesLeft: row._sum.remaining ?? 0,
      })),
      promoClients,
      recent: recent.map((row) => ({
        id: row.id,
        source: row.source,
        minutes: row.minutes,
        remaining: row.remaining,
        note: row.note,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
        to: row.client.user.username ?? row.client.user.name,
      })),
    };
  }
}

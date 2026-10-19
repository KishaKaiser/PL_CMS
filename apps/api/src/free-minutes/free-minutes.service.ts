import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@pl-cms/db';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Free call minutes. A grant is a number of minutes given to a client; while a call is billed, free minutes are
 * used first and the wallet is only charged once they run out.
 *
 *  - An advisor's gift (1, 3 or 5 minutes) can only be used on calls with that advisor, and lapses after 30 days.
 *  - An admin gift, or the welcome promotion for new clients, can be used with any advisor.
 *
 * Free minutes never touch the wallet balance, so they create no revenue and no refund.
 */

export const ADVISOR_GIFT_MINUTES = [1, 3, 5];
const ADVISOR_GIFT_EXPIRY_DAYS = 30;
const MAX_ADMIN_MINUTES = 600;
const MAX_NOTE_LENGTH = 200;
export const WELCOME_PROMO_KEY = 'welcome';
const PROMO_SETTING_KEY = 'welcome_promo';
const DAY_MS = 24 * 60 * 60 * 1000;

type Db = PrismaService | Prisma.TransactionClient;

export interface WelcomePromo {
  enabled: boolean;
  minutes: number;
  /** Days the minutes last once granted; null = they never expire. */
  expiresInDays: number | null;
}

const DEFAULT_PROMO: WelcomePromo = { enabled: false, minutes: 5, expiresInDays: 30 };

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
    };
  } catch {
    return DEFAULT_PROMO;
  }
}

/**
 * Gives a brand-new client the welcome minutes, if the promotion is on. Safe to call more than once for the same
 * client (the promotion key is unique per client). Meant to run inside the transaction that creates the profile.
 */
export async function grantWelcomePromo(db: Db, clientId: string): Promise<void> {
  const promo = await readPromo(db);
  if (!promo.enabled) return;
  await db.freeMinuteGrant.createMany({
    data: [
      {
        clientId,
        minutes: promo.minutes,
        remaining: promo.minutes,
        source: 'PROMO',
        promoKey: WELCOME_PROMO_KEY,
        note: 'Welcome promotion',
        expiresAt: promo.expiresInDays ? new Date(Date.now() + promo.expiresInDays * DAY_MS) : null,
      },
    ],
    skipDuplicates: true,
  });
}

@Injectable()
export class FreeMinutesService {
  constructor(private readonly prisma: PrismaService) {}

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

  async getPromo(): Promise<WelcomePromo> {
    return readPromo(this.prisma);
  }

  async setPromo(input: { enabled: boolean; minutes: number; expiresInDays?: number | null }): Promise<WelcomePromo> {
    if (!Number.isInteger(input.minutes) || input.minutes < 1 || input.minutes > MAX_ADMIN_MINUTES) {
      throw new BadRequestException(`Choose between 1 and ${MAX_ADMIN_MINUTES} minutes.`);
    }
    if (input.expiresInDays != null && (!Number.isInteger(input.expiresInDays) || input.expiresInDays < 1 || input.expiresInDays > 365)) {
      throw new BadRequestException('Minutes can last between 1 and 365 days, or never expire.');
    }
    const promo: WelcomePromo = { enabled: input.enabled, minutes: input.minutes, expiresInDays: input.expiresInDays ?? null };
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

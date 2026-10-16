import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Role } from '@pl-cms/shared';
import { BillingService, LIVE_STATUSES, MIN_CALL_MINUTES, toCents } from '../billing/billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_WAIT_MINUTES, JoinQueueDto } from './callbacks.dto';

const MINUTE_MS = 60_000;

/** Spots that are still in play: waiting for a turn, or being called right now. */
export const ACTIVE_QUEUE_STATUSES = ['WAITING', 'CALLING'];

/**
 * Nobody is waited on: a client who does not pick up loses their turn and the next client is called.
 * The call to a client is a single try.
 */

/** Hold the queue while an appointment is this close, so a queued callback never runs into a booked call. */
const APPOINTMENT_BUFFER_MINUTES = 10;

/** A spot stuck mid-dial (the server restarted, say) goes back in line after this long. */
const STUCK_DIALING_MINUTES = 2;

/** How long a client is told what happened to a spot that ended without a call. */
const RECENT_OUTCOME_MINUTES = 15;

@Injectable()
export class CallbacksService {
  private readonly logger = new Logger(CallbacksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

  // ── Client actions ─────────────────────────────────────────────────────────

  /** Puts the client in line for an advisor who is on a call. */
  async join(userId: string, dto: JoinQueueDto) {
    const client = await this.prisma.clientProfile.findUnique({ where: { userId } });
    if (!client) throw new NotFoundException('Client profile not found');
    if (!client.phoneNumber) throw new BadRequestException('Add your phone number so we know where to call you.');

    const advisor = await this.prisma.advisorProfile.findUnique({ where: { id: dto.advisorId } });
    if (!advisor) throw new NotFoundException('Advisor not found');
    if (!advisor.isOnline || !advisor.phoneNumber) {
      throw new BadRequestException('This advisor is not taking calls right now.');
    }
    if (!advisor.queueCallingEnabled) {
      throw new BadRequestException('This advisor is not taking a callback queue right now.');
    }

    const rateCents = toCents(advisor.ratePerMinute);
    if (rateCents <= 0) throw new BadRequestException('This advisor has not set a rate yet.');
    const requiredCents = rateCents * MIN_CALL_MINUTES;
    if (client.balanceCents < requiredCents) {
      throw new BadRequestException(
        `You need at least $${(requiredCents / 100).toFixed(2)} (${MIN_CALL_MINUTES} minutes) in your wallet to wait for this advisor.`,
      );
    }

    const existing = await this.prisma.queueAssignment.findFirst({
      where: { clientId: client.id, status: { in: ACTIVE_QUEUE_STATUSES } },
      select: { queue: { select: { advisor: { select: { displayName: true } } } } },
    });
    if (existing) {
      throw new ConflictException(
        `You are already in line for ${existing.queue.advisor.displayName}. Leave that line first to join another.`,
      );
    }

    const ownCall = await this.prisma.callSession.findFirst({
      where: { clientId: client.id, status: { in: LIVE_STATUSES } },
      select: { id: true },
    });
    if (ownCall) throw new ConflictException('You already have a call in progress.');

    const [onCall, ahead] = await Promise.all([
      this.prisma.callSession.findFirst({
        where: { advisorId: advisor.id, status: { in: LIVE_STATUSES } },
        select: { id: true },
      }),
      this.prisma.queueAssignment.count({
        where: { status: { in: ACTIVE_QUEUE_STATUSES }, queue: { advisorId: advisor.id } },
      }),
    ]);
    if (!onCall && ahead === 0) {
      throw new ConflictException('This advisor is available right now. Press Call Now instead.');
    }

    const queue = await this.ensureQueue(advisor.id, advisor.displayName);
    const maxWaitMinutes = dto.maxWaitMinutes ?? DEFAULT_WAIT_MINUTES;
    await this.prisma.queueAssignment.create({
      data: {
        queueId: queue.id,
        clientId: client.id,
        position: ahead + 1,
        maxWaitMinutes,
        expiresAt: new Date(Date.now() + maxWaitMinutes * MINUTE_MS),
      },
    });

    return this.mine({ id: userId, role: Role.CLIENT });
  }

  /** The client leaves the line. Once the system is already ringing them it is too late to cancel here. */
  async leave(userId: string, id: string) {
    const spot = await this.prisma.queueAssignment.findUnique({
      where: { id },
      select: { status: true, client: { select: { userId: true } } },
    });
    if (!spot) throw new NotFoundException('Queue spot not found');
    if (spot.client.userId !== userId) throw new ForbiddenException();

    if (spot.status === 'CALLING') {
      throw new BadRequestException('We are calling you right now. Answer to begin, or hang up to skip this turn.');
    }
    if (spot.status === 'WAITING') {
      await this.prisma.queueAssignment.updateMany({ where: { id, status: 'WAITING' }, data: { status: 'CANCELLED' } });
    }
    return { ok: true };
  }

  /**
   * The signed-in client's place in line (and what happened to their last spot, if it just ended), or for an
   * advisor how many clients are waiting for them.
   */
  async mine(user: { id: string; role: string }) {
    if (user.role === Role.ADVISOR) {
      const advisor = await this.prisma.advisorProfile.findUnique({
        where: { userId: user.id },
        select: { id: true, queueCallingEnabled: true },
      });
      if (!advisor) return { role: 'advisor' as const, enabled: false, waiting: 0 };
      const waiting = await this.prisma.queueAssignment.count({
        where: { status: { in: ACTIVE_QUEUE_STATUSES }, queue: { advisorId: advisor.id } },
      });
      return { role: 'advisor' as const, enabled: advisor.queueCallingEnabled, waiting };
    }

    const client = await this.prisma.clientProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!client) return { role: 'client' as const, entry: null, recent: null };

    const select = {
      id: true,
      status: true,
      note: true,
      joinedAt: true,
      expiresAt: true,
      queue: { select: { advisor: { select: { id: true, displayName: true, slug: true } } } },
    } as const;

    const active = await this.prisma.queueAssignment.findFirst({
      where: { clientId: client.id, status: { in: ACTIVE_QUEUE_STATUSES } },
      select: { ...select, queueId: true },
      orderBy: { joinedAt: 'desc' },
    });

    if (active) {
      const position =
        active.status === 'CALLING'
          ? 0
          : (await this.prisma.queueAssignment.count({
              where: { queueId: active.queueId, status: { in: ACTIVE_QUEUE_STATUSES }, joinedAt: { lt: active.joinedAt } },
            })) + 1;
      return {
        role: 'client' as const,
        entry: {
          id: active.id,
          status: active.status,
          position,
          expiresAt: active.expiresAt,
          advisor: {
            id: active.queue.advisor.id,
            displayName: active.queue.advisor.displayName,
            slug: active.queue.advisor.slug,
          },
        },
        recent: null,
      };
    }

    const recent = await this.prisma.queueAssignment.findFirst({
      where: {
        clientId: client.id,
        status: { in: ['MISSED', 'EXPIRED'] },
        note: { not: null },
        updatedAt: { gt: new Date(Date.now() - RECENT_OUTCOME_MINUTES * MINUTE_MS) },
      },
      select,
      orderBy: { updatedAt: 'desc' },
    });
    return {
      role: 'client' as const,
      entry: null,
      recent: recent
        ? { id: recent.id, status: recent.status, note: recent.note, advisorName: recent.queue.advisor.displayName }
        : null,
    };
  }

  // ── Scheduler ──────────────────────────────────────────────────────────────

  /** Every 10 seconds: closes spots that can no longer be served, records how calls ended, and calls the next client. */
  @Cron('*/10 * * * * *')
  async handleTick() {
    const steps: Array<[string, () => Promise<void>]> = [
      ['close old spots', () => this.expireSpots()],
      ['record call outcomes', () => this.recordOutcomes()],
      ['call the next clients', () => this.dispatch()],
    ];
    for (const [label, step] of steps) {
      await step().catch((error: unknown) => {
        this.logger.error(`Callback queue could not ${label}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      });
    }
  }

  private async expireSpots() {
    const now = new Date();

    await this.prisma.queueAssignment.updateMany({
      where: { status: 'WAITING', expiresAt: { lte: now } },
      data: {
        status: 'EXPIRED',
        note: 'You waited as long as you chose, so we took you out of the line. Join again whenever you like.',
      },
    });

    await this.prisma.queueAssignment.updateMany({
      where: {
        status: 'WAITING',
        OR: [{ queue: { advisor: { isOnline: false } } }, { queue: { advisor: { queueCallingEnabled: false } } }],
      },
      data: {
        status: 'EXPIRED',
        note: 'The advisor is no longer taking callbacks, so the line has closed. You have not been charged.',
      },
    });
  }

  /** Once the call placed for a spot has ended: completed if it connected, otherwise the turn is missed. */
  private async recordOutcomes() {
    const calling = await this.prisma.queueAssignment.findMany({
      where: { status: 'CALLING' },
      select: {
        id: true,
        updatedAt: true,
        callSessionId: true,
        callSession: { select: { status: true, connectedAt: true } },
      },
    });

    for (const spot of calling) {
      const session = spot.callSession;

      if (!session) {
        // Claimed but never got a call (the server restarted mid-dial): back in line to be tried again.
        if (Date.now() - spot.updatedAt.getTime() > STUCK_DIALING_MINUTES * MINUTE_MS) {
          await this.prisma.queueAssignment.updateMany({
            where: { id: spot.id, status: 'CALLING', callSessionId: null },
            data: { status: 'WAITING' },
          });
        }
        continue;
      }

      if (!session.status.startsWith('ENDED')) continue;

      if (session.connectedAt) {
        await this.prisma.queueAssignment.updateMany({
          where: { id: spot.id, status: 'CALLING' },
          data: { status: 'COMPLETED', note: null },
        });
      } else {
        await this.prisma.queueAssignment.updateMany({
          where: { id: spot.id, status: 'CALLING' },
          data: {
            status: 'MISSED',
            note: 'We called but the call did not connect, so your turn passed. You have not been charged. Join the line again if you would still like to talk.',
          },
        });
      }
    }
  }

  /** For every advisor who is free, calls the client who has waited longest. */
  private async dispatch() {
    const waiting = await this.prisma.queueAssignment.findMany({
      where: { status: 'WAITING' },
      select: { id: true, clientId: true, queue: { select: { advisorId: true } } },
      orderBy: { joinedAt: 'asc' },
    });

    const byAdvisor = new Map<string, Array<{ id: string; clientId: string; advisorId: string }>>();
    for (const spot of waiting) {
      const advisorId = spot.queue.advisorId;
      const list = byAdvisor.get(advisorId) ?? [];
      list.push({ id: spot.id, clientId: spot.clientId, advisorId });
      byAdvisor.set(advisorId, list);
    }

    for (const [advisorId, spots] of byAdvisor) {
      if (!(await this.advisorIsFree(advisorId))) continue;

      for (const spot of spots) {
        if ((await this.callSpot(spot)) === 'placed') break;
      }
    }
  }

  private async advisorIsFree(advisorId: string): Promise<boolean> {
    const [ringing, onCall, appointmentSoon] = await Promise.all([
      this.prisma.queueAssignment.count({ where: { status: 'CALLING', queue: { advisorId } } }),
      this.prisma.callSession.findFirst({
        where: { advisorId, status: { in: LIVE_STATUSES } },
        select: { id: true },
      }),
      this.prisma.appointment.findFirst({
        where: {
          advisorId,
          status: { in: ['ACCEPTED', 'IN_PROGRESS'] },
          scheduledAt: { lte: new Date(Date.now() + APPOINTMENT_BUFFER_MINUTES * MINUTE_MS) },
        },
        select: { id: true },
      }),
    ]);
    return ringing === 0 && onCall === null && appointmentSoon === null;
  }

  private async callSpot(spot: { id: string; clientId: string; advisorId: string }): Promise<'placed' | 'skipped'> {
    // Claim it so an overlapping run (or a second server) can't dial the same spot twice.
    const claim = await this.prisma.queueAssignment.updateMany({
      where: { id: spot.id, status: 'WAITING' },
      data: { status: 'CALLING' },
    });
    if (claim.count === 0) return 'skipped';

    try {
      await this.billing.startQueuedCall(spot);
      this.logger.log(`Calling queued client for spot ${spot.id}`);
      return 'placed';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      // Something about this client or advisor rules the call out (no funds, no phone number).
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        this.logger.warn(`Queue spot ${spot.id} could not be called: ${message}`);
        await this.prisma.queueAssignment.updateMany({
          where: { id: spot.id, status: 'CALLING' },
          data: {
            status: 'EXPIRED',
            callSessionId: null,
            note: `We could not call you: ${message.replace(/\.$/, '')}. Fix that and join the line again.`,
          },
        });
        return 'skipped';
      }

      // Someone got onto a call a moment ago: keep their turn and try again shortly.
      if (error instanceof ConflictException) {
        await this.prisma.queueAssignment.updateMany({
          where: { id: spot.id, status: 'CALLING' },
          data: { status: 'WAITING', callSessionId: null },
        });
        return 'skipped';
      }

      // The phone service had a problem. That uses up this turn rather than retrying every few seconds.
      this.logger.error(`Queue spot ${spot.id} could not be dialed: ${message}`);
      await this.prisma.queueAssignment.updateMany({
        where: { id: spot.id, status: 'CALLING' },
        data: {
          status: 'MISSED',
          callSessionId: null,
          note: 'We could not place the call because of a phone service problem. You have not been charged. Please join the line again.',
        },
      });
      return 'skipped';
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Each advisor has one queue, made the first time someone joins. */
  private async ensureQueue(advisorId: string, displayName: string) {
    const existing = await this.prisma.callQueue.findFirst({ where: { advisorId }, select: { id: true } });
    if (existing) return existing;
    return this.prisma.callQueue.create({
      data: { advisorId, name: `${displayName} callbacks` },
      select: { id: true },
    });
  }
}

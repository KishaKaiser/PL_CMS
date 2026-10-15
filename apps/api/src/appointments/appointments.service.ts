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
import { PrismaService } from '../prisma/prisma.service';
import { BillingService, MIN_CALL_MINUTES, toCents } from '../billing/billing.service';
import { RequestAppointmentDto } from './appointments.dto';

/** The earliest a client can book, counted from now. */
export const MIN_LEAD_MINUTES = 30;
export const MAX_ADVANCE_DAYS = 60;

/** Appointments for the same advisor (or the same client) must be at least this far apart. */
const SLOT_MINUTES = 30;

/** An advisor can only accept a request if there are at least this many minutes left before it. */
const MIN_ACCEPT_LEAD_MINUTES = 5;

/** After the scheduled time the system keeps trying to place the call this long, then marks it missed. */
const CALL_WINDOW_MINUTES = 10;

/** An appointment stuck mid-dial (the server restarted, say) is put back in the queue after this long. */
const STUCK_DIALING_MINUTES = 2;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const OPEN_STATUSES = ['PENDING', 'ACCEPTED', 'IN_PROGRESS'];
const BOOKED_STATUSES = ['ACCEPTED', 'IN_PROGRESS'];

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

  /** Advisors a client can book, whether or not they are online right now. Never exposes phone numbers. */
  listBookableAdvisors() {
    return this.prisma.advisorProfile.findMany({
      where: { phoneNumber: { not: null }, ratePerMinute: { gt: 0 } },
      select: { id: true, displayName: true, bio: true, profileImageUrl: true, ratePerMinute: true },
      orderBy: { displayName: 'asc' },
      take: 100,
    });
  }

  async request(userId: string, dto: RequestAppointmentDto) {
    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) throw new BadRequestException('Choose a valid date and time.');

    const now = Date.now();
    if (scheduledAt.getTime() < now + MIN_LEAD_MINUTES * MINUTE_MS) {
      throw new BadRequestException(`Appointments must be booked at least ${MIN_LEAD_MINUTES} minutes ahead.`);
    }
    if (scheduledAt.getTime() > now + MAX_ADVANCE_DAYS * DAY_MS) {
      throw new BadRequestException(`Appointments can be booked up to ${MAX_ADVANCE_DAYS} days ahead.`);
    }

    const client = await this.prisma.clientProfile.findUnique({
      where: { userId },
      include: { user: { select: { name: true } } },
    });
    if (!client) throw new NotFoundException('Client profile not found');
    if (!client.phoneNumber) {
      throw new BadRequestException('Add your phone number so we know where to call you.');
    }

    const advisor = await this.prisma.advisorProfile.findUnique({ where: { id: dto.advisorId } });
    if (!advisor || !advisor.phoneNumber) {
      throw new BadRequestException('This advisor is not available for scheduled calls yet.');
    }

    const rateCents = toCents(advisor.ratePerMinute);
    if (rateCents <= 0) throw new BadRequestException('This advisor has not set a rate yet.');

    const requiredCents = rateCents * MIN_CALL_MINUTES;
    if (client.balanceCents < requiredCents) {
      throw new BadRequestException(
        `You need at least $${(requiredCents / 100).toFixed(2)} (${MIN_CALL_MINUTES} minutes) in your wallet to book this advisor. ` +
          'The same amount is checked again when the call is placed.',
      );
    }

    const nearby = nearbyWindow(scheduledAt);
    const advisorBooked = await this.prisma.appointment.findFirst({
      where: { advisorId: advisor.id, status: { in: BOOKED_STATUSES }, scheduledAt: nearby },
      select: { id: true },
    });
    if (advisorBooked) {
      throw new ConflictException('This advisor is already booked around that time. Please choose another time.');
    }
    const clientBusy = await this.prisma.appointment.findFirst({
      where: { clientId: client.id, status: { in: OPEN_STATUSES }, scheduledAt: nearby },
      select: { id: true },
    });
    if (clientBusy) throw new ConflictException('You already have an appointment around that time.');

    const appointment = await this.prisma.appointment.create({
      data: { advisorId: advisor.id, clientId: client.id, scheduledAt },
      select: { id: true, scheduledAt: true, status: true },
    });

    await this.notify(
      userId,
      advisor.userId,
      `New appointment request from ${client.displayName || client.user.name} for ${formatUtc(scheduledAt)}. ` +
        'Open Appointments in your dashboard to accept or decline.',
    );

    return appointment;
  }

  /** The signed-in client's or advisor's appointments, upcoming and recent. */
  async listMine(user: { id: string; role: string }) {
    const select = {
      id: true,
      scheduledAt: true,
      status: true,
      note: true,
      createdAt: true,
      advisor: { select: { id: true, displayName: true, ratePerMinute: true } },
      client: { select: { displayName: true } },
    } as const;

    if (user.role === Role.CLIENT) {
      const client = await this.prisma.clientProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
      if (!client) return [];
      return this.prisma.appointment.findMany({
        where: { clientId: client.id },
        select,
        orderBy: { scheduledAt: 'desc' },
        take: 100,
      });
    }

    if (user.role === Role.ADVISOR) {
      const advisor = await this.prisma.advisorProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
      if (!advisor) return [];
      return this.prisma.appointment.findMany({
        where: { advisorId: advisor.id },
        select,
        orderBy: { scheduledAt: 'desc' },
        take: 100,
      });
    }

    return [];
  }

  async accept(userId: string, id: string) {
    const appointment = await this.getForAdvisor(userId, id);
    if (appointment.status !== 'PENDING') throw new BadRequestException('This request has already been answered.');
    if (appointment.scheduledAt.getTime() < Date.now() + MIN_ACCEPT_LEAD_MINUTES * MINUTE_MS) {
      throw new BadRequestException('That time is too close or has already passed. Please decline this request.');
    }

    const booked = await this.prisma.appointment.findFirst({
      where: {
        advisorId: appointment.advisorId,
        id: { not: id },
        status: { in: BOOKED_STATUSES },
        scheduledAt: nearbyWindow(appointment.scheduledAt),
      },
      select: { id: true },
    });
    if (booked) throw new ConflictException('You already have an accepted appointment around that time.');

    const claim = await this.prisma.appointment.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'ACCEPTED' },
    });
    if (claim.count === 0) throw new BadRequestException('This request has already been answered.');

    await this.notify(
      userId,
      appointment.client.userId,
      `${appointment.advisor.displayName} accepted your appointment for ${formatUtc(appointment.scheduledAt)}. ` +
        'We will call you at that time. Please make sure your wallet has funds.',
    );
    return { id, status: 'ACCEPTED' };
  }

  async decline(userId: string, id: string) {
    const appointment = await this.getForAdvisor(userId, id);

    const claim = await this.prisma.appointment.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'DECLINED' },
    });
    if (claim.count === 0) throw new BadRequestException('This request has already been answered.');

    await this.notify(
      userId,
      appointment.client.userId,
      `${appointment.advisor.displayName} is not able to take your appointment for ${formatUtc(appointment.scheduledAt)}. ` +
        'You can request another time.',
    );
    return { id, status: 'DECLINED' };
  }

  async cancel(user: { id: string; role: string }, id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        advisor: { select: { userId: true, displayName: true } },
        client: { select: { userId: true, displayName: true } },
      },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');

    const isClient = appointment.client.userId === user.id;
    const isAdvisor = appointment.advisor.userId === user.id;
    if (!isClient && !isAdvisor) throw new ForbiddenException();

    const claim = await this.prisma.appointment.updateMany({
      where: { id, status: { in: ['PENDING', 'ACCEPTED'] } },
      data: { status: 'CANCELLED' },
    });
    if (claim.count === 0) {
      throw new BadRequestException('This appointment can no longer be cancelled.');
    }

    const who = isClient ? appointment.client.displayName : appointment.advisor.displayName;
    await this.notify(
      user.id,
      isClient ? appointment.advisor.userId : appointment.client.userId,
      `${who} cancelled the appointment for ${formatUtc(appointment.scheduledAt)}.`,
    );
    return { id, status: 'CANCELLED' };
  }

  // ── Scheduler ──────────────────────────────────────────────────────────────

  /** Runs every 30 seconds: expires stale requests, places due callbacks, and records how calls ended. */
  @Cron('*/30 * * * * *')
  async handleTick() {
    const steps: Array<[string, () => Promise<void>]> = [
      ['expire unanswered requests', () => this.expireUnanswered()],
      ['mark overdue appointments missed', () => this.markOverdueMissed()],
      ['place due calls', () => this.placeDueCalls()],
      ['record call outcomes', () => this.recordOutcomes()],
    ];
    for (const [label, step] of steps) {
      await step().catch((error: unknown) => {
        this.logger.error(`Appointment scheduler could not ${label}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      });
    }
  }

  /** A request nobody answered before its time arrives can no longer be accepted. */
  private async expireUnanswered() {
    await this.prisma.appointment.updateMany({
      where: { status: 'PENDING', scheduledAt: { lte: new Date() } },
      data: { status: 'EXPIRED', note: 'The advisor did not respond before the scheduled time.' },
    });
  }

  /** An accepted appointment that could not be placed within the window (someone was busy) is missed. */
  private async markOverdueMissed() {
    await this.prisma.appointment.updateMany({
      where: {
        status: 'ACCEPTED',
        scheduledAt: { lt: new Date(Date.now() - CALL_WINDOW_MINUTES * MINUTE_MS) },
      },
      data: {
        status: 'MISSED',
        note: `The call could not be placed within ${CALL_WINDOW_MINUTES} minutes of the scheduled time.`,
      },
    });
  }

  private async placeDueCalls() {
    const now = new Date();
    const due = await this.prisma.appointment.findMany({
      where: {
        status: 'ACCEPTED',
        scheduledAt: { lte: now, gte: new Date(now.getTime() - CALL_WINDOW_MINUTES * MINUTE_MS) },
      },
      select: { id: true, clientId: true, advisorId: true },
    });
    for (const appointment of due) {
      await this.placeCall(appointment);
    }
  }

  private async placeCall(appointment: { id: string; clientId: string; advisorId: string }) {
    // Claim it so an overlapping run (or a second server) can't dial the same appointment twice.
    const claim = await this.prisma.appointment.updateMany({
      where: { id: appointment.id, status: 'ACCEPTED' },
      data: { status: 'IN_PROGRESS' },
    });
    if (claim.count === 0) return;

    try {
      await this.billing.startScheduledCall(appointment);
      this.logger.log(`Placed the scheduled call for appointment ${appointment.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      // Nothing here is the client's or advisor's fault except a hard problem with the booking itself
      // (no funds, no phone number). Everything else (someone on another call, a phone-service hiccup)
      // is retried on the next tick until the window runs out.
      const hard = error instanceof BadRequestException || error instanceof NotFoundException;
      if (hard) {
        this.logger.warn(`Appointment ${appointment.id} could not be placed: ${message}`);
        await this.prisma.appointment.updateMany({
          where: { id: appointment.id, status: 'IN_PROGRESS' },
          data: { status: 'MISSED', note: message },
        });
      } else {
        await this.prisma.appointment.updateMany({
          where: { id: appointment.id, status: 'IN_PROGRESS' },
          data: { status: 'ACCEPTED', callSessionId: null },
        });
      }
    }
  }

  /** Once the call placed for an appointment has ended, mark it completed (it connected) or missed (it did not). */
  private async recordOutcomes() {
    const inProgress = await this.prisma.appointment.findMany({
      where: { status: 'IN_PROGRESS' },
      select: {
        id: true,
        updatedAt: true,
        callSessionId: true,
        callSession: { select: { status: true, connectedAt: true } },
      },
    });

    for (const appointment of inProgress) {
      const session = appointment.callSession;

      if (!session) {
        // Claimed but never got a call (the server restarted mid-dial): put it back so it is retried.
        if (Date.now() - appointment.updatedAt.getTime() > STUCK_DIALING_MINUTES * MINUTE_MS) {
          await this.prisma.appointment.updateMany({
            where: { id: appointment.id, status: 'IN_PROGRESS', callSessionId: null },
            data: { status: 'ACCEPTED' },
          });
        }
        continue;
      }

      if (!session.status.startsWith('ENDED')) continue;

      await this.prisma.appointment.updateMany({
        where: { id: appointment.id, status: 'IN_PROGRESS' },
        data: session.connectedAt
          ? { status: 'COMPLETED' }
          : { status: 'MISSED', note: 'The call did not connect: a press-1 prompt was not answered.' },
      });
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async getForAdvisor(userId: string, id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        advisor: { select: { userId: true, displayName: true } },
        client: { select: { userId: true } },
      },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    if (appointment.advisor.userId !== userId) throw new ForbiddenException();
    return appointment;
  }

  /** Sends an in-app message. Only used for things a person did (a request, an answer, a cancellation). */
  private async notify(senderId: string, recipientId: string, body: string) {
    try {
      await this.prisma.message.create({ data: { senderId, recipientId, body } });
    } catch (error) {
      this.logger.warn(`Could not send an appointment message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/** The span either side of a time within which another appointment counts as overlapping it. */
function nearbyWindow(time: Date) {
  return {
    gt: new Date(time.getTime() - SLOT_MINUTES * MINUTE_MS),
    lt: new Date(time.getTime() + SLOT_MINUTES * MINUTE_MS),
  };
}

/** "2026-10-21 18:30 UTC": messages are plain text, so each person sees their own local time in the dashboard list. */
function formatUtc(date: Date): string {
  return `${date.toISOString().replace('T', ' ').slice(0, 16)} UTC`;
}

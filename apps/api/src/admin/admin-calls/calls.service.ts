import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@pl-cms/db';
import { BillingService, LIVE_STATUSES } from '../../billing/billing.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const PAGE_SIZE = 50;
const MAX_EXPORT_ROWS = 10_000;
const MAX_REVENUE_ROWS = 20_000;

export interface CallFilter {
  from?: string;
  to?: string;
  advisorId?: string;
  clientId?: string;
  outcome?: string;
  source?: string;
  search?: string;
}

const OUTCOMES = ['all', 'connected', 'problem', 'live'];
const SOURCES = ['all', 'DIRECT', 'APPOINTMENT', 'QUEUE', 'HOTLINE'];

/** What happened to a call, in words an admin can read. */
export const STATUS_LABELS: Record<string, string> = {
  PENDING_CONNECTION: 'Calling the client',
  AWAITING_CLIENT: 'Waiting for the client to press 1',
  DIALING_ADVISOR: 'Calling the advisor',
  CONNECTED: 'Talking (free period)',
  BILLING_ACTIVE: 'Talking (billed)',
  ENDED: 'Completed',
  ENDED_BY_USER: 'Ended by the client',
  ENDED_BY_ADMIN: 'Ended by an admin',
  ENDED_LOW_BALANCE: 'Ended: out of funds',
  ENDED_NOT_CONNECTED: 'Did not connect',
};

const SOURCE_LABELS: Record<string, string> = {
  DIRECT: 'Call Now',
  APPOINTMENT: 'Appointment',
  QUEUE: 'Callback line',
  HOTLINE: 'Hotline',
};

const rowSelect = {
  id: true,
  startedAt: true,
  connectedAt: true,
  endedAt: true,
  durationSeconds: true,
  billedMinutes: true,
  billedAmountCents: true,
  status: true,
  source: true,
  advisor: { select: { id: true, displayName: true } },
  client: { select: { id: true, user: { select: { username: true, email: true } } } },
  appointment: { select: { id: true } },
  queueAssignment: { select: { id: true } },
} as const satisfies Prisma.CallSessionSelect;

type CallRow = Prisma.CallSessionGetPayload<{ select: typeof rowSelect }>;

@Injectable()
export class AdminCallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly audit: AuditService,
  ) {}

  // ── Call log ───────────────────────────────────────────────────────────────

  async list(filter: CallFilter, page: number) {
    const where = this.buildWhere(filter);
    const currentPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

    const [rows, total, sums, connected] = await Promise.all([
      this.prisma.callSession.findMany({
        where,
        select: rowSelect,
        orderBy: { startedAt: 'desc' },
        skip: (currentPage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      this.prisma.callSession.count({ where }),
      this.prisma.callSession.aggregate({
        where,
        _sum: { billedAmountCents: true, billedMinutes: true, durationSeconds: true },
      }),
      this.prisma.callSession.count({ where: { AND: [where, { connectedAt: { not: null } }] } }),
    ]);

    return {
      page: currentPage,
      pageSize: PAGE_SIZE,
      total,
      totals: {
        calls: total,
        connected,
        billedMinutes: sums._sum.billedMinutes ?? 0,
        billedAmountCents: sums._sum.billedAmountCents ?? 0,
        talkSeconds: sums._sum.durationSeconds ?? 0,
      },
      calls: rows.map(toCallView),
    };
  }

  /** The same filtered log as a CSV file, newest first, for the admin's own records. */
  async exportCsv(filter: CallFilter): Promise<string> {
    const rows = await this.prisma.callSession.findMany({
      where: this.buildWhere(filter),
      select: rowSelect,
      orderBy: { startedAt: 'desc' },
      take: MAX_EXPORT_ROWS,
    });

    const header = [
      'Call ID',
      'Started (UTC)',
      'Advisor',
      'Client username',
      'Client email',
      'How it started',
      'Outcome',
      'Connected (UTC)',
      'Ended (UTC)',
      'Talk time (seconds)',
      'Minutes billed',
      'Amount billed (USD)',
    ];
    const lines = [header.map(csvCell).join(',')];
    for (const row of rows.map(toCallView)) {
      lines.push(
        [
          row.id,
          row.startedAt.toISOString(),
          row.advisor.displayName,
          row.client.username ?? '',
          row.client.email,
          row.sourceLabel,
          row.statusLabel,
          row.connectedAt?.toISOString() ?? '',
          row.endedAt?.toISOString() ?? '',
          row.talkSeconds,
          row.billedMinutes,
          (row.billedAmountCents / 100).toFixed(2),
        ]
          .map(csvCell)
          .join(','),
      );
    }
    return `${lines.join('\r\n')}\r\n`;
  }

  // ── Live view ──────────────────────────────────────────────────────────────

  /** Calls in progress right now, and where every advisor stands. */
  async live() {
    const now = Date.now();
    const [sessions, advisors, waiting, booked] = await Promise.all([
      this.prisma.callSession.findMany({
        where: { status: { in: LIVE_STATUSES } },
        select: rowSelect,
        orderBy: { startedAt: 'asc' },
      }),
      this.prisma.advisorProfile.findMany({
        where: { phoneNumber: { not: null } },
        select: { id: true, displayName: true, isOnline: true, queueCallingEnabled: true },
        orderBy: { displayName: 'asc' },
      }),
      this.prisma.queueAssignment.findMany({
        where: { status: { in: ['WAITING', 'CALLING'] } },
        select: { queue: { select: { advisorId: true } } },
      }),
      this.prisma.appointment.findMany({
        where: { status: { in: ['PENDING', 'ACCEPTED'] }, scheduledAt: { gt: new Date() } },
        select: { advisorId: true, status: true },
      }),
    ]);

    const onCall = new Set(sessions.map((session) => session.advisor.id));
    const waitingBy = countBy(waiting.map((spot) => spot.queue.advisorId));
    const acceptedBy = countBy(booked.filter((a) => a.status === 'ACCEPTED').map((a) => a.advisorId));
    const pendingBy = countBy(booked.filter((a) => a.status === 'PENDING').map((a) => a.advisorId));

    return {
      calls: sessions.map((session) => ({
        ...toCallView(session),
        elapsedSeconds: Math.max(0, Math.floor((now - session.startedAt.getTime()) / 1000)),
        talkingSeconds: session.connectedAt ? Math.max(0, Math.floor((now - session.connectedAt.getTime()) / 1000)) : 0,
      })),
      advisors: advisors.map((advisor) => ({
        id: advisor.id,
        displayName: advisor.displayName,
        status: onCall.has(advisor.id) ? 'ON_CALL' : advisor.isOnline ? 'ONLINE' : 'OFFLINE',
        acceptsLine: advisor.queueCallingEnabled,
        waitingInLine: waitingBy.get(advisor.id) ?? 0,
        upcomingAppointments: acceptedBy.get(advisor.id) ?? 0,
        appointmentRequests: pendingBy.get(advisor.id) ?? 0,
      })),
    };
  }

  async endCall(actorId: string, id: string) {
    const result = await this.billing.endSessionAsAdmin(id);
    await this.audit.log(actorId, 'call.end', 'CallSession', id, {
      billedMinutes: result.billedMinutes,
      billedAmountCents: result.billedAmountCents,
    });
    return result;
  }

  // ── Revenue ────────────────────────────────────────────────────────────────

  /** What was billed in the period: per advisor and per day (days are cut in the admin's own time zone). */
  async revenue(filter: CallFilter, timeZone: string | undefined) {
    const zone = validZone(timeZone);
    const where = this.buildWhere({ ...filter, outcome: 'all' });

    const rows = await this.prisma.callSession.findMany({
      where: { AND: [where, { endedAt: { not: null } }] },
      select: {
        startedAt: true,
        connectedAt: true,
        durationSeconds: true,
        billedMinutes: true,
        billedAmountCents: true,
        advisor: { select: { id: true, displayName: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: MAX_REVENUE_ROWS,
    });

    const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' });
    const byAdvisor = new Map<string, { advisorId: string; displayName: string; calls: number; connected: number; billedMinutes: number; billedAmountCents: number; talkSeconds: number }>();
    const byDay = new Map<string, { day: string; calls: number; billedAmountCents: number }>();
    const totals = { calls: 0, connected: 0, billedMinutes: 0, billedAmountCents: 0, talkSeconds: 0 };

    for (const row of rows) {
      const cents = row.billedAmountCents ?? 0;
      const minutes = row.billedMinutes ?? 0;
      const talk = row.durationSeconds ?? 0;
      const connected = row.connectedAt ? 1 : 0;

      const advisor = byAdvisor.get(row.advisor.id) ?? {
        advisorId: row.advisor.id,
        displayName: row.advisor.displayName,
        calls: 0,
        connected: 0,
        billedMinutes: 0,
        billedAmountCents: 0,
        talkSeconds: 0,
      };
      advisor.calls += 1;
      advisor.connected += connected;
      advisor.billedMinutes += minutes;
      advisor.billedAmountCents += cents;
      advisor.talkSeconds += talk;
      byAdvisor.set(row.advisor.id, advisor);

      const day = dayKey.format(row.startedAt);
      const bucket = byDay.get(day) ?? { day, calls: 0, billedAmountCents: 0 };
      bucket.calls += 1;
      bucket.billedAmountCents += cents;
      byDay.set(day, bucket);

      totals.calls += 1;
      totals.connected += connected;
      totals.billedMinutes += minutes;
      totals.billedAmountCents += cents;
      totals.talkSeconds += talk;
    }

    return {
      timeZone: zone,
      truncated: rows.length >= MAX_REVENUE_ROWS,
      totals,
      advisors: [...byAdvisor.values()].sort((a, b) => b.billedAmountCents - a.billedAmountCents),
      days: [...byDay.values()].sort((a, b) => (a.day < b.day ? 1 : -1)),
    };
  }

  // ── Filters ────────────────────────────────────────────────────────────────

  private buildWhere(filter: CallFilter): Prisma.CallSessionWhereInput {
    const outcome = filter.outcome ?? 'all';
    const source = filter.source ?? 'all';
    if (!OUTCOMES.includes(outcome)) throw new BadRequestException('Unknown outcome filter.');
    if (!SOURCES.includes(source)) throw new BadRequestException('Unknown source filter.');

    const startedAt: Prisma.DateTimeFilter = {};
    if (filter.from) startedAt.gte = parseDate(filter.from, 'start');
    if (filter.to) startedAt.lte = parseDate(filter.to, 'end');

    const search = filter.search?.trim();
    const and: Prisma.CallSessionWhereInput[] = [];

    if (outcome === 'connected') and.push({ connectedAt: { not: null } });
    if (outcome === 'problem') and.push({ status: { in: ['ENDED_NOT_CONNECTED', 'ENDED_LOW_BALANCE'] } });
    if (outcome === 'live') and.push({ status: { in: LIVE_STATUSES } });

    if (source === 'APPOINTMENT') and.push({ appointment: { isNot: null } });
    if (source === 'QUEUE') and.push({ queueAssignment: { isNot: null } });
    if (source === 'DIRECT') and.push({ source: 'DIRECT', appointment: null, queueAssignment: null });
    if (source === 'HOTLINE') and.push({ source: 'HOTLINE' });

    if (search) {
      and.push({
        OR: [
          { advisor: { displayName: { contains: search, mode: 'insensitive' } } },
          { client: { user: { username: { contains: search, mode: 'insensitive' } } } },
          { client: { user: { email: { contains: search, mode: 'insensitive' } } } },
        ],
      });
    }

    return {
      ...(Object.keys(startedAt).length > 0 ? { startedAt } : {}),
      ...(filter.advisorId ? { advisorId: filter.advisorId } : {}),
      ...(filter.clientId ? { clientId: filter.clientId } : {}),
      ...(and.length > 0 ? { AND: and } : {}),
    };
  }
}

function toCallView(row: CallRow) {
  const how = row.appointment ? 'APPOINTMENT' : row.queueAssignment ? 'QUEUE' : row.source === 'HOTLINE' ? 'HOTLINE' : 'DIRECT';
  return {
    id: row.id,
    startedAt: row.startedAt,
    connectedAt: row.connectedAt,
    endedAt: row.endedAt,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] ?? row.status,
    live: LIVE_STATUSES.includes(row.status),
    source: how,
    sourceLabel: SOURCE_LABELS[how],
    advisor: row.advisor,
    client: { id: row.client.id, username: row.client.user.username, email: row.client.user.email },
    talkSeconds: row.durationSeconds ?? 0,
    billedMinutes: row.billedMinutes ?? 0,
    billedAmountCents: row.billedAmountCents ?? 0,
  };
}

function parseDate(value: string, edge: 'start' | 'end'): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`The ${edge === 'start' ? 'from' : 'to'} date is not valid.`);
  return date;
}

function validZone(zone: string | undefined): string {
  if (!zone) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return zone;
  } catch {
    return 'UTC';
  }
}

function countBy(ids: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/** One CSV cell. Quoted when needed, and a leading = + - or @ is defused so a spreadsheet cannot run it as a formula. */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

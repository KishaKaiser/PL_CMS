import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { normalizeEmailInput } from '../common/input-normalization.util';
import { displayNameFromUsername, generateUniqueUsername } from '../common/public-identity';
import { MailService, escapeHtml } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePhoneNumber } from '../telephony/phone-number';
import { SubmitApplicationDto } from './onboarding.dto';
import { ONBOARDING_LINK_DAYS, hashToken, newOnboardingToken } from './onboarding.constants';
import { OnboardingService } from './onboarding.service';

export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
const STATUSES: ApplicationStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

/** The public form allows this many applications from one address per hour. */
const SUBMISSIONS_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);
  private readonly recent = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly onboarding: OnboardingService,
  ) {}

  // ── The public application ─────────────────────────────────────────────────

  async submit(dto: SubmitApplicationDto, ipAddress: string | undefined): Promise<{ ok: true }> {
    // Bots fill in every field they can find, including the hidden one: say thanks and keep nothing.
    if (dto.website?.trim()) return { ok: true };

    const key = ipAddress ?? 'unknown';
    const now = Date.now();
    const times = (this.recent.get(key) ?? []).filter((time) => now - time < HOUR_MS);
    if (times.length >= SUBMISSIONS_PER_HOUR) {
      throw new HttpException('You have sent several applications already. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    this.recent.set(key, [...times, now]);
    if (this.recent.size > 5000) this.recent.clear();

    const phone = normalizePhoneNumber(dto.phone);
    if (!phone) throw new BadRequestException('Enter a valid phone number, including area code.');
    const email = normalizeEmailInput(dto.email);

    // A second application from someone still waiting changes nothing: they simply see the same thank-you.
    const waiting = await this.prisma.advisorApplication.findFirst({ where: { email, status: 'PENDING' }, select: { id: true } });
    if (waiting) return { ok: true };

    const created = await this.prisma.advisorApplication.create({
      data: {
        name: dto.name.replace(/\s+/g, ' ').trim(),
        email,
        phone,
        yearsExperience: dto.yearsExperience,
        gifts: dto.gifts.trim(),
        readingStyle: dto.readingStyle.trim(),
        ipAddress: ipAddress ?? null,
      },
      select: { name: true, email: true },
    });
    void this.notifyAdminsNewApplication(created.name, created.email);
    return { ok: true };
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  async list(statusInput: string | undefined) {
    const status = statusInput && statusInput !== 'all' ? statusInput.toUpperCase() : undefined;
    if (status && !(STATUSES as string[]).includes(status)) throw new BadRequestException('Unknown status.');

    const rows = await this.prisma.advisorApplication.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        yearsExperience: true,
        status: true,
        createdAt: true,
        reviewedAt: true,
        onboarding: { select: { advisorId: true, activatedAt: true, completedAt: true, cancelledAt: true } },
      },
    });

    const withProgress = await Promise.all(
      rows.map(async (row) => {
        const progress = row.onboarding && !row.onboarding.cancelledAt ? await this.onboarding.stepsFor(row.onboarding.advisorId) : null;
        return {
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          yearsExperience: row.yearsExperience,
          status: row.status,
          createdAt: row.createdAt,
          reviewedAt: row.reviewedAt,
          onboarding: progress
            ? {
                activated: !!row.onboarding?.activatedAt,
                completed: progress.completed,
                done: progress.steps.filter((step) => step.done).length,
                total: progress.steps.length,
              }
            : null,
        };
      }),
    );
    const counts = await this.prisma.advisorApplication.groupBy({ by: ['status'], _count: { _all: true } });
    return {
      counts: Object.fromEntries(STATUSES.map((s) => [s, counts.find((c) => c.status === s)?._count._all ?? 0])),
      applications: withProgress,
    };
  }

  async get(id: string) {
    const application = await this.prisma.advisorApplication.findUnique({
      where: { id },
      include: { onboarding: { select: { advisorId: true, activatedAt: true, emailSentAt: true, tokenExpiresAt: true, completedAt: true, cancelledAt: true, cancelReason: true } } },
    });
    if (!application) throw new NotFoundException('Application not found');

    const advisorId = application.onboarding?.advisorId;
    const [progress, documents] = advisorId ? await Promise.all([this.onboarding.stepsFor(advisorId), this.onboardingDocuments(advisorId)]) : [null, []];
    return {
      id: application.id,
      name: application.name,
      email: application.email,
      phone: application.phone,
      yearsExperience: application.yearsExperience,
      gifts: application.gifts,
      readingStyle: application.readingStyle,
      status: application.status,
      reviewNote: application.reviewNote,
      reviewedAt: application.reviewedAt,
      createdAt: application.createdAt,
      onboarding: application.onboarding
        ? {
            activatedAt: application.onboarding.activatedAt,
            emailSentAt: application.onboarding.emailSentAt,
            linkExpiresAt: application.onboarding.tokenExpiresAt,
            completedAt: application.onboarding.completedAt,
            cancelledAt: application.onboarding.cancelledAt,
            cancelReason: application.onboarding.cancelReason,
            steps: progress?.steps ?? [],
          }
        : null,
      documents,
    };
  }

  /** Approves an application: creates the advisor's account and emails them the link to start onboarding. */
  async approve(adminId: string, id: string) {
    const application = await this.prisma.advisorApplication.findUnique({ where: { id }, include: { onboarding: { select: { id: true } } } });
    if (!application) throw new NotFoundException('Application not found');
    // An approved (or cancelled) application whose advisor account no longer exists, because it was deleted, can be approved again.
    if (application.status === 'APPROVED' && application.onboarding) throw new ConflictException('This application is already approved. Use "Send the link again" to resend the email.');
    if (application.status === 'CANCELLED' && application.onboarding) throw new ConflictException('This onboarding was cancelled. Use "Reopen onboarding" to let them continue.');

    const existing = await this.prisma.user.findUnique({ where: { email: application.email }, select: { id: true } });
    if (existing) throw new ConflictException('An account with this email address already exists, so it cannot be turned into an advisor account here.');

    const { token, tokenHash, expiresAt } = newOnboardingToken();
    const username = await generateUniqueUsername(this.prisma, 'ADVISOR');
    // Nobody can sign in until they set their own password from the emailed link.
    const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);

    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: application.email, username, name: application.name, role: 'ADVISOR', passwordHash },
        select: { id: true },
      });
      const advisor = await tx.advisorProfile.create({
        data: { userId: user.id, displayName: displayNameFromUsername(username), phoneNumber: application.phone },
        select: { id: true },
      });
      await tx.advisorOnboarding.create({ data: { advisorId: advisor.id, applicationId: application.id, tokenHash, tokenExpiresAt: expiresAt } });
      await tx.advisorApplication.update({
        where: { id: application.id },
        data: { status: 'APPROVED', reviewedById: adminId, reviewedAt: new Date(), userId: user.id },
      });
    });

    const link = this.linkFor(token);
    const emailSent = await this.sendOnboardingEmail(application.name, application.email, link, expiresAt);
    if (emailSent) await this.prisma.advisorOnboarding.update({ where: { applicationId: application.id }, data: { emailSentAt: new Date() } });
    return { id: application.id, link, emailSent, linkExpiresAt: expiresAt };
  }

  /** A fresh link (the old one stops working), emailed again. For an advisor who lost the email or let the link expire. */
  async resendLink(id: string) {
    const application = await this.prisma.advisorApplication.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, status: true, onboarding: { select: { id: true, completedAt: true } } },
    });
    if (!application || !['APPROVED', 'CANCELLED'].includes(application.status) || !application.onboarding) throw new NotFoundException('This application has not been approved.');
    if (application.onboarding.completedAt) throw new BadRequestException('This advisor has already finished onboarding.');

    const { token, tokenHash, expiresAt } = newOnboardingToken();
    // Reopening a cancelled onboarding clears the cancellation, so the account can be used again once they set a password.
    await this.prisma.$transaction([
      this.prisma.advisorOnboarding.update({
        where: { id: application.onboarding.id },
        data: { tokenHash, tokenExpiresAt: expiresAt, emailSentAt: null, activatedAt: null, cancelledAt: null, cancelReason: null },
      }),
      this.prisma.advisorApplication.update({ where: { id: application.id }, data: { status: 'APPROVED' } }),
    ]);
    const link = this.linkFor(token);
    const emailSent = await this.sendOnboardingEmail(application.name, application.email, link, expiresAt);
    if (emailSent) await this.prisma.advisorOnboarding.update({ where: { id: application.onboarding.id }, data: { emailSentAt: new Date() } });
    return { id: application.id, link, emailSent, linkExpiresAt: expiresAt };
  }

  /** Adds a form the advisor emailed instead of uploading (the signed W-9, for example). Stored like any other form. */
  async addDocument(id: string, type: string, file: { buffer?: Buffer } | undefined) {
    const application = await this.prisma.advisorApplication.findUnique({ where: { id }, select: { onboarding: { select: { advisorId: true } } } });
    if (!application?.onboarding) throw new NotFoundException('This application has no onboarding yet.');
    return this.onboarding.uploadForAdvisor(application.onboarding.advisorId, type, file);
  }

  /**
   * Cancels an approved advisor's onboarding. The link stops working, the account is locked (nobody can sign in with it, and any
   * sign-in still open stops working), and the application shows as Cancelled. Anything the advisor already submitted is kept.
   * "Reopen onboarding" (a new link) undoes it.
   */
  async cancelOnboarding(id: string, note: string | undefined) {
    const application = await this.prisma.advisorApplication.findUnique({
      where: { id },
      select: { id: true, status: true, userId: true, onboarding: { select: { id: true, completedAt: true } } },
    });
    if (!application || !['APPROVED', 'CANCELLED'].includes(application.status)) throw new NotFoundException('This application has not been approved.');
    if (application.status === 'CANCELLED') throw new ConflictException('This onboarding is already cancelled.');
    // The advisor account was deleted, so there is nothing left to lock: just record that it is cancelled.
    if (!application.onboarding || !application.userId) {
      await this.prisma.advisorApplication.update({ where: { id }, data: { status: 'CANCELLED', reviewNote: note?.trim() || 'The advisor account no longer exists.' } });
      return { id, status: 'CANCELLED' };
    }
    if (application.onboarding.completedAt) throw new ConflictException('This advisor has already finished onboarding, so there is nothing to cancel.');

    const lockedPassword = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
    await this.prisma.$transaction([
      this.prisma.advisorOnboarding.update({
        where: { id: application.onboarding.id },
        data: {
          cancelledAt: new Date(),
          cancelReason: note?.trim() || null,
          // A replacement the advisor never received, so the emailed link can no longer be used.
          tokenHash: hashToken(randomBytes(32).toString('base64url')),
          tokenExpiresAt: new Date(),
        },
      }),
      this.prisma.advisorApplication.update({ where: { id }, data: { status: 'CANCELLED' } }),
      this.prisma.user.update({ where: { id: application.userId }, data: { passwordHash: lockedPassword } }),
      this.prisma.advisorProfile.updateMany({ where: { userId: application.userId }, data: { isOnline: false } }),
    ]);
    return { id, status: 'CANCELLED' };
  }

  async reject(adminId: string, id: string, note: string | undefined) {
    const application = await this.prisma.advisorApplication.findUnique({ where: { id }, select: { status: true, onboarding: { select: { id: true } } } });
    if (!application) throw new NotFoundException('Application not found');
    if ((application.status === 'APPROVED' || application.status === 'CANCELLED') && application.onboarding) throw new ConflictException('This application was already approved. Cancel its onboarding instead.');
    await this.prisma.advisorApplication.update({
      where: { id },
      data: { status: 'REJECTED', reviewedById: adminId, reviewedAt: new Date(), reviewNote: note?.trim() || null },
    });
    return { id, status: 'REJECTED' };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async onboardingDocuments(advisorId: string) {
    const docs = await this.prisma.onboardingDocument.findMany({
      where: { advisorId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, type: true, source: true, fileName: true, sizeBytes: true, createdAt: true, supersededAt: true },
    });
    return docs;
  }

  private linkFor(token: string): string {
    const base = (this.config.get<string>('WEB_BASE_URL') ?? 'http://localhost:3000').replace(/\/$/, '');
    return `${base}/advisor-onboarding?token=${encodeURIComponent(token)}`;
  }

  private sendOnboardingEmail(name: string, email: string, link: string, expiresAt: Date): Promise<boolean> {
    const first = escapeHtml(name.split(' ')[0] || 'there');
    const date = expiresAt.toDateString();
    return this.mail.send({
      to: email,
      subject: 'Welcome to The Psychic Link: start your advisor onboarding',
      text:
        `Hi ${name.split(' ')[0] || 'there'},\n\nGreat news: your application to become an advisor with The Psychic Link has been approved.\n\n` +
        `Start your onboarding here:\n${link}\n\n` +
        `You will create your password, then work through a short checklist: sign the Advisor Agreement, submit your W-9, choose your display name, ` +
        `add a profile photo, set your rate per minute and choose how you are paid. The link works until ${date}.\n\n` +
        `If you did not apply, you can ignore this email.\n\nThe Psychic Link`,
      html:
        `<p>Hi ${first},</p><p>Great news: your application to become an advisor with <strong>The Psychic Link</strong> has been approved.</p>` +
        `<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#6d28d9;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">Start your onboarding</a></p>` +
        `<p>You will create your password, then work through a short checklist: sign the Advisor Agreement, submit your W-9, choose your display name, add a profile photo, set your rate per minute and choose how you are paid.</p>` +
        `<p>The link works for ${ONBOARDING_LINK_DAYS} days (until ${escapeHtml(date)}). If the button does not work, copy this address into your browser:<br>${escapeHtml(link)}</p>` +
        `<p>If you did not apply, you can ignore this email.</p><p>The Psychic Link</p>`,
    });
  }

  private async notifyAdminsNewApplication(name: string, email: string): Promise<void> {
    try {
      const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } });
      if (admins.length === 0) return;
      const base = (this.config.get<string>('WEB_BASE_URL') ?? '').replace(/\/$/, '');
      await this.mail.send({
        to: admins.map((admin) => admin.email),
        subject: `New advisor application from ${name}`,
        text: `${name} (${email}) has applied to become an advisor. Review it in Admin > Advisor applications${base ? `: ${base}/admin/advisor-applications` : '.'}`,
        html: `<p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}) has applied to become an advisor.</p><p>Review it in <strong>Admin &gt; Advisor applications</strong>${base ? `: <a href="${escapeHtml(base)}/admin/advisor-applications">${escapeHtml(base)}/admin/advisor-applications</a>` : '.'}</p>`,
      });
    } catch (error) {
      this.logger.warn(`Could not tell the admins about a new advisor application: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { normalizeEmailInput } from '../common/input-normalization.util';
import { EmailComposer } from '../mail/email-composer';
import { EmailSettingsService } from '../mail/email-settings.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

/** How long a reset link works. */
export const RESET_LINK_MINUTES = 60;
const MAX_LINKS_PER_HOUR = 3;
const MIN_SECONDS_BETWEEN_LINKS = 60;

export const hashResetToken = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * "Forgot password". A link with a secret in it is emailed to the account's address. Only a hash of the secret is stored, the
 * link works once and for an hour, and using it signs out every older sign-in. Asking for a link never says whether an account
 * exists, and no more than a few links an hour are made for one account.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly settings: EmailSettingsService,
    private readonly composer: EmailComposer,
  ) {}

  /** Never throws and gives no sign of whether the account exists: the caller answers the same way either way. */
  async request(identifier: string): Promise<void> {
    try {
      const value = normalizeEmailInput(String(identifier ?? ''));
      if (!value) return;
      const user = await this.prisma.user.findUnique({
        where: value.includes('@') ? { email: value } : { username: value },
        select: { id: true, email: true, name: true },
      });
      if (!user) return;

      const now = Date.now();
      // Tidy up old links now and then.
      await this.prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date(now - 24 * 60 * 60 * 1000) } } });

      const recent = await this.prisma.passwordResetToken.findMany({
        where: { userId: user.id, createdAt: { gt: new Date(now - 60 * 60 * 1000) } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (recent.length >= MAX_LINKS_PER_HOUR) return;
      if (recent[0] && now - recent[0].createdAt.getTime() < MIN_SECONDS_BETWEEN_LINKS * 1000) return;

      const siteUrl = await this.settings.siteUrl();
      if (!siteUrl || !(await this.mail.isConfigured())) {
        this.logger.warn('A password reset was asked for, but email is not set up (Admin → Email), so no link was sent.');
        return;
      }

      const token = randomBytes(32).toString('base64url');
      await this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt: new Date(now + RESET_LINK_MINUTES * 60 * 1000) },
      });

      const resetUrl = `${siteUrl}/reset-password?token=${token}`;
      const title = await this.settings.siteTitle();
      const email = await this.composer.compose(
        'password_reset',
        { customerName: user.name || 'there', resetUrl, expiresIn: `${RESET_LINK_MINUTES} minutes` },
        {
          customer: true,
          button: { url: resetUrl, label: 'Choose a new password' },
          defaultFooter: title ? `You are receiving this because a password reset was asked for on your account at ${title}.` : undefined,
        },
      );
      if (!email) return;
      await this.mail.send({ to: user.email, subject: email.subject, html: email.html, text: email.text }, { kind: 'password-reset' });
    } catch (error) {
      this.logger.warn(`Password reset request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Sets the new password if the link is real, unused and not expired. */
  async reset(token: string, password: string): Promise<void> {
    const invalid = new BadRequestException('This link has expired or was already used. Please ask for a new one.');
    const secret = String(token ?? '').trim();
    if (secret.length < 20 || secret.length > 200) throw invalid;

    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(secret) },
      select: { id: true, userId: true, usedAt: true, expiresAt: true, user: { select: { email: true, name: true } } },
    });
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) throw invalid;

    const passwordHash = await bcrypt.hash(password, 12);
    const changed = await this.prisma.$transaction(async (tx) => {
      // Only the first use counts, even if the link is opened twice at the same moment.
      const claimed = await tx.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
      if (claimed.count === 0) return false;
      await tx.user.update({ where: { id: row.userId }, data: { passwordHash, passwordChangedAt: new Date() } });
      // Any other link asked for earlier is no good now.
      await tx.passwordResetToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: new Date() } });
      return true;
    });
    if (!changed) throw invalid;

    void this.sendChangedNotice(row.user.email, row.user.name);
  }

  /** "Your password was changed", so a change the owner did not make is noticed. Never throws. */
  private async sendChangedNotice(to: string, name: string) {
    try {
      const siteUrl = await this.settings.siteUrl();
      const title = await this.settings.siteTitle();
      const email = await this.composer.compose(
        'password_changed',
        { customerName: name || 'there' },
        {
          customer: true,
          button: siteUrl ? { url: `${siteUrl}/forgot-password`, label: 'Reset it again' } : null,
          defaultFooter: title ? `You are receiving this because the password on your account at ${title} was changed.` : undefined,
        },
      );
      if (email) await this.mail.send({ to, subject: email.subject, html: email.html, text: email.text }, { kind: 'password-changed' });
    } catch (error) {
      this.logger.warn(`Password changed notice failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

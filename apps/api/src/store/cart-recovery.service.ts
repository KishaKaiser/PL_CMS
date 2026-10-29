import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import type { Prisma } from '@pl-cms/db';
import { EmailComposer } from '../mail/email-composer';
import { EmailSettingsService } from '../mail/email-settings.service';
import { MailService } from '../mail/mail.service';
import { signLink, verifyLink } from '../mail/signed-link';
import { PrismaService } from '../prisma/prisma.service';
import { cartItemLines, cartSubtotal, readStoredItems, sanitizeCartItems } from './cart-recovery';
import type { TrackCartDto } from './store.dto';
import { StoreService } from './store.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const OPT_OUT_PURPOSE = 'cart-reminders';
/** At most this many reminders in one run and in a day, so a busy day cannot use up the mail account's sending allowance. */
const MAX_PER_RUN = 20;
const MAX_PER_DAY = 100;

/**
 * Reminders for carts customers leave behind. Only logged-in customers are tracked, and the reminder goes to the email on their
 * own account, so nobody can make the site email a stranger. One reminder per cart, and each carries a link to stop them.
 */
@Injectable()
export class CartRecoveryService {
  private readonly logger = new Logger(CartRecoveryService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly store: StoreService,
    private readonly mail: MailService,
    private readonly emailSettings: EmailSettingsService,
    private readonly composer: EmailComposer,
  ) {}

  private secret() {
    return this.config.get<string>('JWT_REFRESH_SECRET') || this.config.get<string>('DOCUMENT_ENCRYPTION_KEY') || '';
  }

  // ── Tracking the cart ───────────────────────────────────────────────────────────────

  /** Called as a logged-in customer's cart changes. An empty cart ends the reminder. */
  async track(userId: string, dto: TrackCartDto) {
    const settings = await this.store.getCartRecoverySettings();
    if (!settings.enabled) return { success: true, stored: false };

    const items = sanitizeCartItems(dto.items);
    const existing = await this.prisma.abandonedCart.findUnique({ where: { userId } });

    if (items.length === 0) {
      if (existing && (existing.status === 'OPEN' || existing.status === 'EMAILED')) {
        await this.prisma.abandonedCart.update({ where: { userId }, data: { status: 'RECOVERED', items: [], subtotal: 0 } });
      }
      return { success: true, stored: false };
    }
    // Someone who asked not to be reminded stays unsubscribed.
    if (existing?.status === 'UNSUBSCRIBED') return { success: true, stored: false };

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return { success: true, stored: false };
    const now = new Date();
    const data = { email: user.email, items: items as unknown as Prisma.InputJsonValue, subtotal: cartSubtotal(items) };

    if (!existing) {
      await this.prisma.abandonedCart.create({ data: { userId, ...data, status: 'OPEN', startedAt: now, lastActivityAt: now } });
    } else if (existing.status === 'OPEN') {
      await this.prisma.abandonedCart.update({ where: { userId }, data: { ...data, lastActivityAt: now } });
    } else if (existing.status === 'EMAILED') {
      // Already reminded: keep the cart up to date, but only start over once the reminder is old.
      const reminded = existing.reminderSentAt?.getTime() ?? 0;
      const startOver = now.getTime() - reminded > settings.expiresDays * DAY_MS;
      await this.prisma.abandonedCart.update({
        where: { userId },
        data: startOver ? { ...data, status: 'OPEN', reminderSentAt: null, startedAt: now, lastActivityAt: now } : data,
      });
    } else {
      // Recovered or expired earlier: this is a new stretch of shopping.
      await this.prisma.abandonedCart.update({
        where: { userId },
        data: { ...data, status: 'OPEN', reminderSentAt: null, startedAt: now, lastActivityAt: now },
      });
    }
    return { success: true, stored: true };
  }

  /** The customer ordered: no reminder is needed. */
  async markRecovered(userId: string) {
    await this.prisma.abandonedCart.updateMany({ where: { userId, status: { in: ['OPEN', 'EMAILED'] } }, data: { status: 'RECOVERED' } });
  }

  // ── The reminder ────────────────────────────────────────────────────────────────────

  optOutLink(siteUrl: string, email: string) {
    const secret = this.secret();
    return secret ? `${siteUrl}/cart-reminders/unsubscribe?email=${encodeURIComponent(email)}&token=${signLink(OPT_OUT_PURPOSE, email, secret)}` : '';
  }

  /** The link at the bottom of a reminder: stops them for good. No login is needed. */
  async optOut(email: string, token: string) {
    const address = String(email ?? '').trim().toLowerCase();
    if (!verifyLink(OPT_OUT_PURPOSE, address, String(token ?? ''), this.secret())) {
      throw new BadRequestException('This link is not valid.');
    }
    const user = await this.prisma.user.findUnique({ where: { email: address }, select: { id: true } });
    if (user) {
      await this.prisma.abandonedCart.upsert({
        where: { userId: user.id },
        create: { userId: user.id, email: address, items: [], status: 'UNSUBSCRIBED' },
        update: { status: 'UNSUBSCRIBED' },
      });
    }
    return { success: true };
  }

  @Cron('*/10 * * * *')
  async sendDueReminders() {
    if (this.running) return;
    this.running = true;
    try {
      await this.run();
    } catch (error) {
      this.logger.warn(`Cart reminders failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
  }

  /** Public so it can be run directly (the schedule calls it every ten minutes). Returns how many reminders were sent. */
  async run(now = new Date()): Promise<number> {
    const settings = await this.store.getCartRecoverySettings();
    if (!settings.enabled) return 0;

    // Carts nobody came back to for the whole window are let go.
    await this.prisma.abandonedCart.updateMany({
      where: { status: { in: ['OPEN', 'EMAILED'] }, lastActivityAt: { lt: new Date(now.getTime() - settings.expiresDays * DAY_MS) } },
      data: { status: 'EXPIRED' },
    });

    if (!(await this.mail.isConfigured())) return 0;
    const siteUrl = await this.emailSettings.siteUrl();
    // A reminder without the site's address has no link back to the cart, and no way to opt out.
    if (!siteUrl || !this.secret()) return 0;

    const sentToday = await this.prisma.abandonedCart.count({ where: { reminderSentAt: { gte: new Date(now.getTime() - DAY_MS) } } });
    const room = Math.max(0, Math.min(MAX_PER_RUN, MAX_PER_DAY - sentToday));
    if (room === 0) return 0;

    const due = await this.prisma.abandonedCart.findMany({
      where: { status: 'OPEN', lastActivityAt: { lte: new Date(now.getTime() - settings.delayMinutes * 60_000) } },
      orderBy: { lastActivityAt: 'asc' },
      take: room * 2,
      include: { user: { select: { email: true, name: true } } },
    });

    let sent = 0;
    for (const cart of due) {
      if (sent >= room) break;
      const items = readStoredItems(cart.items);
      if (items.length === 0) {
        await this.prisma.abandonedCart.update({ where: { id: cart.id }, data: { status: 'RECOVERED' } });
        continue;
      }
      // They ordered since this cart began: nothing to remind them about.
      const ordered = await this.prisma.order.count({
        where: { userId: cart.userId, createdAt: { gte: cart.startedAt }, status: { notIn: ['CANCELLED', 'PENDING'] } },
      });
      if (ordered > 0) {
        await this.prisma.abandonedCart.update({ where: { id: cart.id }, data: { status: 'RECOVERED' } });
        continue;
      }

      // Take the cart first, so two runs can never send the same reminder.
      const claimed = await this.prisma.abandonedCart.updateMany({
        where: { id: cart.id, status: 'OPEN' },
        data: { status: 'EMAILED', reminderSentAt: now },
      });
      if (claimed.count === 0) continue;

      const optOut = this.optOutLink(siteUrl, cart.user.email);
      const total = cartSubtotal(items);
      const email = await this.composer.compose(
        'cart_recovery',
        {
          customerName: cart.user.name || 'there',
          orderItems: cartItemLines(items),
          total: `$${total.toFixed(2)}`,
          cartUrl: `${siteUrl}/shop/cart`,
        },
        {
          customer: true,
          button: { url: `${siteUrl}/shop/cart`, label: 'Return to your cart' },
          // Always the opt-out line, whatever footer the Email page has.
          fixedFooter: `You are receiving this because you have items in your cart. To stop these reminders: ${optOut}`,
        },
      );
      const delivered = email
        ? await this.mail.send({ to: cart.user.email, subject: email.subject, html: email.html, text: email.text }, { kind: 'cart-reminder' })
        : false;
      if (delivered) {
        sent += 1;
      } else {
        // Not sent (the mail server said no): put it back to try again next time, and stop for now.
        await this.prisma.abandonedCart.update({ where: { id: cart.id }, data: { status: 'OPEN', reminderSentAt: null } });
        break;
      }
    }
    return sent;
  }

  // ── The admin list ──────────────────────────────────────────────────────────────────

  async listForAdmin() {
    const settings = await this.store.getCartRecoverySettings();
    const carts = await this.prisma.abandonedCart.findMany({
      where: { status: { not: 'UNSUBSCRIBED' } },
      orderBy: { lastActivityAt: 'desc' },
      take: 200,
    });
    return carts.map((cart) => ({
      id: cart.id,
      email: cart.email,
      subtotal: Number(cart.subtotal),
      items: readStoredItems(cart.items),
      status: cart.status,
      recoverAfter: new Date(cart.lastActivityAt.getTime() + settings.delayMinutes * 60_000).toISOString(),
      expiresAt: new Date(cart.lastActivityAt.getTime() + settings.expiresDays * DAY_MS).toISOString(),
      reminderSentAt: cart.reminderSentAt?.toISOString() ?? null,
      createdAt: cart.createdAt.toISOString(),
    }));
  }
}

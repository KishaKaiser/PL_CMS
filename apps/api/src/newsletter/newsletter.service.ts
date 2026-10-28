import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { renderEmail } from '../mail/email-layout';
import { EmailSettingsService } from '../mail/email-settings.service';
import { MailService } from '../mail/mail.service';
import { isValidUnsubscribeToken, unsubscribeToken } from './newsletter-unsubscribe';
import { NewsletterSettingsDto, SubscribeDto } from './newsletter.dto';

const NEWSLETTER_SUBSCRIBERS_KEY = 'newsletter_subscribers';
const NEWSLETTER_SETTINGS_KEY = 'newsletter_settings';

export interface NewsletterSubscriber {
  email: string;
  name: string;
  source: string;
  status: 'SUBSCRIBED' | 'UNSUBSCRIBED';
  privacyConsent: boolean;
  termsConsent: boolean;
  consentText: string;
  consentedAt: string;
  subscribedAt: string;
  unsubscribedAt?: string;
}

const DEFAULT_NEWSLETTER_SETTINGS: NewsletterSettingsDto = {
  enabled: true,
  defaultTitle: 'Join Our Newsletter',
  defaultDescription: 'Get updates and offers in your inbox.',
  defaultButtonLabel: 'Subscribe',
  defaultPlaceholder: 'Email address',
  collectName: false,
  privacyPolicyUrl: '/privacy-policy',
  termsUrl: '/terms',
  consentText: 'I agree to the privacy policy and terms and conditions.',
  gdprNotice: 'You can unsubscribe at any time. We store your email only for newsletter communication.',
  retentionPolicy: 'Newsletter subscriber records are kept until unsubscribe or deletion is requested.',
  successMessage: 'Thank you for subscribing.',
  welcomeSubject: 'Welcome to our newsletter',
  welcomeBody: 'Thank you for subscribing. We are glad you are here.',
};

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly emailSettings: EmailSettingsService,
  ) {}

  async subscribe(dto: SubscribeDto) {
    const email = String(dto.email ?? '').trim().toLowerCase();
    const name = String(dto.name ?? '').trim();
    const source = String(dto.source ?? 'website').trim() || 'website';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Enter a valid email address.');
    }
    if (!dto.privacyConsent || !dto.termsConsent) {
      throw new BadRequestException('Please agree to the privacy policy and terms and conditions.');
    }

    if (!(await this.isEnabled())) {
      throw new BadRequestException('Newsletter signup is not enabled.');
    }
    const settings = await this.getSettings();

    const setting = await this.prisma.setting.findUnique({
      where: { key: NEWSLETTER_SUBSCRIBERS_KEY },
    });
    const subscribers = parseSubscribers(setting?.value);
    const existing = subscribers.find((subscriber) => subscriber.email === email);
    // The welcome email goes to new subscribers and to people who had unsubscribed, not to someone who is already on the list.
    const wasSubscribed = existing?.status === 'SUBSCRIBED';

    if (existing) {
      existing.name = name || existing.name;
      existing.source = source || existing.source;
      existing.status = 'SUBSCRIBED';
      existing.privacyConsent = true;
      existing.termsConsent = true;
      existing.consentText = settings.consentText;
      existing.consentedAt = new Date().toISOString();
      existing.unsubscribedAt = undefined;
    } else {
      const now = new Date().toISOString();
      subscribers.push({
        email,
        name,
        source,
        status: 'SUBSCRIBED',
        privacyConsent: true,
        termsConsent: true,
        consentText: settings.consentText,
        consentedAt: now,
        subscribedAt: now,
      });
    }

    if (!existing || existing.status === 'SUBSCRIBED') {
      await this.prisma.setting.upsert({
        where: { key: NEWSLETTER_SUBSCRIBERS_KEY },
        update: { value: JSON.stringify(subscribers) },
        create: { key: NEWSLETTER_SUBSCRIBERS_KEY, value: JSON.stringify(subscribers) },
      });
    }

    if (!wasSubscribed) void this.sendWelcome(email, name, settings);

    return {
      success: true,
      message: existing ? 'You are already subscribed.' : settings.successMessage,
    };
  }

  private secret() {
    return this.config.get<string>('JWT_REFRESH_SECRET') || this.config.get<string>('DOCUMENT_ENCRYPTION_KEY') || '';
  }

  /** The welcome message written in Newsletter settings, with an unsubscribe link at the bottom. Never throws. */
  private async sendWelcome(email: string, name: string, settings: NewsletterSettingsDto) {
    try {
      const secret = this.secret();
      const siteUrl = await this.emailSettings.siteUrl();
      // A newsletter email must always be able to be stopped: without a signed link there is no safe way to offer one.
      if (!secret || !siteUrl) return;
      const link = `${siteUrl}/newsletter/unsubscribe?email=${encodeURIComponent(email)}&token=${unsubscribeToken(email, secret)}`;
      const content = renderEmail({
        body: `${name ? `Hi ${name},\n\n` : ''}${settings.welcomeBody}`,
        footer: `You are receiving this because you subscribed to our newsletter. To stop receiving it, unsubscribe here: ${link}`,
      });
      await this.mail.send({ to: email, subject: settings.welcomeSubject, ...content }, { kind: 'newsletter-welcome' });
    } catch (error) {
      this.logger.warn(`Welcome email failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** The unsubscribe link in an email: checked with its signature, so no login is needed. */
  async unsubscribeWithToken(email: string, token: string) {
    const address = String(email ?? '').trim().toLowerCase();
    if (!isValidUnsubscribeToken(address, String(token ?? ''), this.secret())) {
      throw new BadRequestException('This unsubscribe link is not valid.');
    }
    const subscribers = await this.readSubscribers();
    const subscriber = subscribers.find((item) => item.email === address);
    if (subscriber && subscriber.status !== 'UNSUBSCRIBED') {
      subscriber.status = 'UNSUBSCRIBED';
      subscriber.unsubscribedAt = new Date().toISOString();
      await this.writeJson(NEWSLETTER_SUBSCRIBERS_KEY, subscribers);
    }
    return { success: true };
  }

  async getSettings() {
    return this.readJson<NewsletterSettingsDto>(NEWSLETTER_SETTINGS_KEY, DEFAULT_NEWSLETTER_SETTINGS);
  }

  async saveSettings(dto: NewsletterSettingsDto) {
    const next: NewsletterSettingsDto = {
      enabled: Boolean(dto.enabled),
      defaultTitle: dto.defaultTitle || DEFAULT_NEWSLETTER_SETTINGS.defaultTitle,
      defaultDescription: dto.defaultDescription || DEFAULT_NEWSLETTER_SETTINGS.defaultDescription,
      defaultButtonLabel: dto.defaultButtonLabel || DEFAULT_NEWSLETTER_SETTINGS.defaultButtonLabel,
      defaultPlaceholder: dto.defaultPlaceholder || DEFAULT_NEWSLETTER_SETTINGS.defaultPlaceholder,
      collectName: Boolean(dto.collectName),
      privacyPolicyUrl: dto.privacyPolicyUrl || DEFAULT_NEWSLETTER_SETTINGS.privacyPolicyUrl,
      termsUrl: dto.termsUrl || DEFAULT_NEWSLETTER_SETTINGS.termsUrl,
      consentText: dto.consentText || DEFAULT_NEWSLETTER_SETTINGS.consentText,
      gdprNotice: dto.gdprNotice || DEFAULT_NEWSLETTER_SETTINGS.gdprNotice,
      retentionPolicy: dto.retentionPolicy || DEFAULT_NEWSLETTER_SETTINGS.retentionPolicy,
      successMessage: dto.successMessage || DEFAULT_NEWSLETTER_SETTINGS.successMessage,
      welcomeSubject: dto.welcomeSubject || DEFAULT_NEWSLETTER_SETTINGS.welcomeSubject,
      welcomeBody: dto.welcomeBody || DEFAULT_NEWSLETTER_SETTINGS.welcomeBody,
    };
    await this.writeJson(NEWSLETTER_SETTINGS_KEY, next);
    await this.prisma.module.upsert({
      where: { name: 'newsletter' },
      update: { enabled: next.enabled },
      create: { name: 'newsletter', version: '1.0.0', enabled: next.enabled },
    });
    return next;
  }

  async listSubscribers() {
    return this.readSubscribers();
  }

  async exportSubscribers() {
    const subscribers = await this.readSubscribers();
    return {
      generatedAt: new Date().toISOString(),
      count: subscribers.length,
      subscribers,
    };
  }

  async unsubscribe(email: string) {
    const subscribers = await this.readSubscribers();
    const subscriber = subscribers.find((item) => item.email === email.toLowerCase());
    if (!subscriber) throw new NotFoundException('Subscriber not found.');
    subscriber.status = 'UNSUBSCRIBED';
    subscriber.unsubscribedAt = new Date().toISOString();
    await this.writeJson(NEWSLETTER_SUBSCRIBERS_KEY, subscribers);
    return subscriber;
  }

  async deleteSubscriber(email: string) {
    const subscribers = await this.readSubscribers();
    const next = subscribers.filter((item) => item.email !== email.toLowerCase());
    if (next.length === subscribers.length) throw new NotFoundException('Subscriber not found.');
    await this.writeJson(NEWSLETTER_SUBSCRIBERS_KEY, next);
    return { success: true };
  }

  private async isEnabled() {
    const module = await this.prisma.module.upsert({
      where: { name: 'newsletter' },
      update: {},
      create: { name: 'newsletter', version: '1.0.0', enabled: true },
    });
    const settings = await this.getSettings();
    return module.enabled && settings.enabled;
  }

  private async readSubscribers() {
    const setting = await this.prisma.setting.findUnique({ where: { key: NEWSLETTER_SUBSCRIBERS_KEY } });
    return parseSubscribers(setting?.value);
  }

  private async readJson<T>(key: string, fallback: T): Promise<T> {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    if (!setting) return fallback;
    try {
      return JSON.parse(setting.value) as T;
    } catch {
      return fallback;
    }
  }

  private async writeJson(key: string, value: unknown) {
    await this.prisma.setting.upsert({
      where: { key },
      update: { value: JSON.stringify(value) },
      create: { key, value: JSON.stringify(value) },
    });
  }
}

function parseSubscribers(value: string | undefined): NewsletterSubscriber[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item): NewsletterSubscriber | null => {
        if (!item || typeof item !== 'object') return null;
        const candidate = item as Partial<NewsletterSubscriber>;
        const email = typeof candidate.email === 'string' ? candidate.email : '';
        if (!email) return null;
        return {
          email,
          name: typeof candidate.name === 'string' ? candidate.name : '',
          source: typeof candidate.source === 'string' ? candidate.source : 'website',
          status: candidate.status === 'UNSUBSCRIBED' ? 'UNSUBSCRIBED' : 'SUBSCRIBED',
          privacyConsent: candidate.privacyConsent === true,
          termsConsent: candidate.termsConsent === true,
          consentText: typeof candidate.consentText === 'string' ? candidate.consentText : DEFAULT_NEWSLETTER_SETTINGS.consentText,
          consentedAt: typeof candidate.consentedAt === 'string' ? candidate.consentedAt : (typeof candidate.subscribedAt === 'string' ? candidate.subscribedAt : new Date().toISOString()),
          subscribedAt: typeof candidate.subscribedAt === 'string' ? candidate.subscribedAt : new Date().toISOString(),
          unsubscribedAt: typeof candidate.unsubscribedAt === 'string' ? candidate.unsubscribedAt : undefined,
        };
      })
      .filter((item): item is NewsletterSubscriber => item !== null);
  } catch {
    return [];
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NewsletterSettingsDto, SubscribeDto } from './newsletter.dto';

const NEWSLETTER_SUBSCRIBERS_KEY = 'newsletter_subscribers';
const NEWSLETTER_SETTINGS_KEY = 'newsletter_settings';

export interface NewsletterSubscriber {
  email: string;
  name: string;
  source: string;
  status: 'SUBSCRIBED' | 'UNSUBSCRIBED';
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
  successMessage: 'Thank you for subscribing.',
  welcomeSubject: 'Welcome to our newsletter',
  welcomeBody: 'Thank you for subscribing. We are glad you are here.',
};

@Injectable()
export class NewsletterService {
  constructor(private readonly prisma: PrismaService) {}

  async subscribe(dto: SubscribeDto) {
    const email = String(dto.email ?? '').trim().toLowerCase();
    const name = String(dto.name ?? '').trim();
    const source = String(dto.source ?? 'website').trim() || 'website';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Enter a valid email address.');
    }

    if (!(await this.isEnabled())) {
      throw new BadRequestException('Newsletter signup is not enabled.');
    }

    const setting = await this.prisma.setting.findUnique({
      where: { key: NEWSLETTER_SUBSCRIBERS_KEY },
    });
    const subscribers = parseSubscribers(setting?.value);
    const existing = subscribers.find((subscriber) => subscriber.email === email);

    if (existing) {
      existing.name = name || existing.name;
      existing.source = source || existing.source;
      existing.status = 'SUBSCRIBED';
      existing.unsubscribedAt = undefined;
    } else {
      subscribers.push({ email, name, source, status: 'SUBSCRIBED', subscribedAt: new Date().toISOString() });
    }

    if (!existing || existing.status === 'SUBSCRIBED') {
      await this.prisma.setting.upsert({
        where: { key: NEWSLETTER_SUBSCRIBERS_KEY },
        update: { value: JSON.stringify(subscribers) },
        create: { key: NEWSLETTER_SUBSCRIBERS_KEY, value: JSON.stringify(subscribers) },
      });
    }

    return {
      success: true,
      message: existing ? 'You are already subscribed.' : (await this.getSettings()).successMessage,
    };
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
          subscribedAt: typeof candidate.subscribedAt === 'string' ? candidate.subscribedAt : new Date().toISOString(),
          unsubscribedAt: typeof candidate.unsubscribedAt === 'string' ? candidate.unsubscribedAt : undefined,
        };
      })
      .filter((item): item is NewsletterSubscriber => item !== null);
  } catch {
    return [];
  }
}

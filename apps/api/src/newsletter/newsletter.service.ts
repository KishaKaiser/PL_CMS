import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const NEWSLETTER_SUBSCRIBERS_KEY = 'newsletter_subscribers';

interface SubscribeDto {
  email?: string;
  name?: string;
}

interface NewsletterSubscriber {
  email: string;
  name: string;
  subscribedAt: string;
}

@Injectable()
export class NewsletterService {
  constructor(private readonly prisma: PrismaService) {}

  async subscribe(dto: SubscribeDto) {
    const email = String(dto.email ?? '').trim().toLowerCase();
    const name = String(dto.name ?? '').trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Enter a valid email address.');
    }

    const module = await this.prisma.module.upsert({
      where: { name: 'newsletter' },
      update: {},
      create: { name: 'newsletter', version: '1.0.0', enabled: true },
    });

    if (!module.enabled) {
      throw new BadRequestException('Newsletter signup is not enabled.');
    }

    const setting = await this.prisma.setting.findUnique({
      where: { key: NEWSLETTER_SUBSCRIBERS_KEY },
    });
    const subscribers = parseSubscribers(setting?.value);
    const existing = subscribers.find((subscriber) => subscriber.email === email);

    if (!existing) {
      subscribers.push({ email, name, subscribedAt: new Date().toISOString() });
      await this.prisma.setting.upsert({
        where: { key: NEWSLETTER_SUBSCRIBERS_KEY },
        update: { value: JSON.stringify(subscribers) },
        create: { key: NEWSLETTER_SUBSCRIBERS_KEY, value: JSON.stringify(subscribers) },
      });
    }

    return {
      success: true,
      message: existing ? 'You are already subscribed.' : 'Thank you for subscribing.',
    };
  }
}

function parseSubscribers(value: string | undefined): NewsletterSubscriber[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const candidate = item as Partial<NewsletterSubscriber>;
        const email = typeof candidate.email === 'string' ? candidate.email : '';
        if (!email) return null;
        return {
          email,
          name: typeof candidate.name === 'string' ? candidate.name : '',
          subscribedAt: typeof candidate.subscribedAt === 'string' ? candidate.subscribedAt : new Date().toISOString(),
        };
      })
      .filter((item): item is NewsletterSubscriber => Boolean(item));
  } catch {
    return [];
  }
}

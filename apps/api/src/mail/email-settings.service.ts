import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { decryptBuffer, encryptBuffer } from '../onboarding/document-crypto';
import {
  defaultEmailSettings,
  formatFrom,
  isEmailAddress,
  normalizeEmailSettings,
  normalizeSiteUrl,
  type EmailSettings,
} from './email-settings';

export const EMAIL_SETTINGS_KEY = 'email_settings';
const CACHE_MS = 30_000;

export interface SaveEmailSettingsInput {
  provider?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  username?: string;
  /** Only sent when it is being changed. */
  password?: string;
  clearPassword?: boolean;
  fromName?: string;
  fromAddress?: string;
  notifyAddress?: string;
  siteUrl?: string;
  notifyOnOrders?: boolean;
  notifyOnForms?: boolean;
}

/** What `MailService` sends with: the server, the account, and who the mail is from. Null when email is not set up. */
export interface EffectiveMailConfig {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  auth: { user: string; pass: string } | null;
  from: string;
  replyTo?: string;
  /** Where the settings came from: the admin page, or the server's SMTP_* environment variables. */
  source: 'settings' | 'environment';
}

@Injectable()
export class EmailSettingsService {
  private cache: { at: number; settings: EmailSettings } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private secret(): string {
    const secret = this.config.get<string>('DOCUMENT_ENCRYPTION_KEY') || this.config.get<string>('JWT_REFRESH_SECRET');
    if (!secret) {
      throw new ServiceUnavailableException('The mail password cannot be stored securely on this server yet. Ask the site owner to set DOCUMENT_ENCRYPTION_KEY.');
    }
    return secret;
  }

  async get(): Promise<EmailSettings> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.settings;
    const row = await this.prisma.setting.findUnique({ where: { key: EMAIL_SETTINGS_KEY } });
    let settings = defaultEmailSettings();
    if (row?.value) {
      try {
        settings = normalizeEmailSettings(JSON.parse(row.value));
      } catch {
        /* a damaged value counts as "not set up" */
      }
    }
    this.cache = { at: Date.now(), settings };
    return settings;
  }

  async save(input: SaveEmailSettingsInput): Promise<EmailSettings> {
    const current = await this.get();
    if (input.fromAddress && !isEmailAddress(input.fromAddress)) throw new BadRequestException('The "from" address is not a valid email address.');
    if (input.notifyAddress && !isEmailAddress(input.notifyAddress)) throw new BadRequestException('The address for alerts is not a valid email address.');
    if (input.siteUrl && !normalizeSiteUrl(input.siteUrl)) throw new BadRequestException('The site address must start with http:// or https://.');

    let passwordEnc = current.passwordEnc;
    if (input.clearPassword) passwordEnc = '';
    const newPassword = input.password?.trim();
    if (newPassword) passwordEnc = encryptBuffer(Buffer.from(newPassword, 'utf8'), this.secret()).toString('base64');

    const next = normalizeEmailSettings({ ...current, ...stripUndefined(input), passwordEnc });
    const value = JSON.stringify(next);
    await this.prisma.setting.upsert({ where: { key: EMAIL_SETTINGS_KEY }, create: { key: EMAIL_SETTINGS_KEY, value }, update: { value } });
    this.cache = { at: Date.now(), settings: next };
    return next;
  }

  private decryptPassword(settings: EmailSettings): string | null {
    if (!settings.passwordEnc) return null;
    const plain = decryptBuffer(Buffer.from(settings.passwordEnc, 'base64'), this.secret());
    return plain ? plain.toString('utf8') : null;
  }

  /** The mail account to send with: the one saved on the admin page, else the server's SMTP_* variables, else none. */
  async getEffective(): Promise<EffectiveMailConfig | null> {
    const settings = await this.get();
    if (settings.host && settings.username && settings.passwordEnc) {
      const password = this.decryptPassword(settings);
      if (password) {
        const fromAddress = settings.fromAddress || settings.username;
        return {
          host: settings.host,
          port: settings.port,
          secure: settings.secure,
          // iCloud (and any server on port 587) upgrades to an encrypted connection with STARTTLS: insist on it.
          requireTLS: !settings.secure,
          auth: { user: settings.username, pass: password },
          from: formatFrom(settings.fromName, fromAddress),
          source: 'settings',
        };
      }
    }

    const host = this.config.get<string>('SMTP_HOST');
    if (!host) return null;
    const port = Number(this.config.get<string>('SMTP_PORT')) || 587;
    const user = this.config.get<string>('SMTP_USER');
    return {
      host,
      port,
      secure: String(this.config.get<string>('SMTP_SECURE') ?? port === 465).toLowerCase() === 'true',
      requireTLS: false,
      auth: user ? { user, pass: this.config.get<string>('SMTP_PASS') ?? '' } : null,
      from: this.config.get<string>('SMTP_FROM') ?? user ?? 'no-reply@example.com',
      source: 'environment',
    };
  }

  /** The site's own address, for links in emails: saved here, else the server's SITE_URL. Empty when unknown. */
  async siteUrl(): Promise<string> {
    const saved = (await this.get()).siteUrl;
    if (saved) return saved;
    return normalizeSiteUrl(this.config.get<string>('SITE_URL') || this.config.get<string>('NEXT_PUBLIC_SITE_URL') || '');
  }

  /** The address that gets new-order and new-form alerts: saved here, else the "from" address. */
  async alertAddress(): Promise<string> {
    const settings = await this.get();
    return settings.notifyAddress || settings.fromAddress || settings.username || '';
  }
}

function stripUndefined<T extends object>(input: T): Partial<T> {
  return Object.fromEntries(Object.entries(input).filter(([key, value]) => value !== undefined && key !== 'password' && key !== 'clearPassword')) as Partial<T>;
}

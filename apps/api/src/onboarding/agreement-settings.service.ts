import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_AGREEMENT_BODY, DEFAULT_AGREEMENT_TITLE } from './agreement-text';

const SETTINGS_KEY = 'advisor_agreement';
const MAX_BODY_LENGTH = 60_000;

export interface AgreementSettings {
  title: string;
  body: string;
  /** Who signs for the company; printed on the agreement (the signature line is left for them). */
  representativeName: string;
  representativeTitle: string;
  /** An address advisors can email a signed form to (shown in the W-9 step); empty = not offered. */
  formsEmail: string;
}

/** The wording of the Advisor Agreement, which admin can edit. A signed copy keeps the wording it was signed with. */
@Injectable()
export class AgreementSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<AgreementSettings> {
    const defaults: AgreementSettings = { title: DEFAULT_AGREEMENT_TITLE, body: DEFAULT_AGREEMENT_BODY, representativeName: '', representativeTitle: '', formsEmail: '' };
    const row = await this.prisma.setting.findUnique({ where: { key: SETTINGS_KEY } });
    if (!row) return defaults;
    try {
      const saved = JSON.parse(row.value) as Partial<AgreementSettings>;
      return {
        title: typeof saved.title === 'string' && saved.title.trim() ? saved.title : defaults.title,
        body: typeof saved.body === 'string' && saved.body.trim() ? saved.body : defaults.body,
        representativeName: typeof saved.representativeName === 'string' ? saved.representativeName : '',
        representativeTitle: typeof saved.representativeTitle === 'string' ? saved.representativeTitle : '',
        formsEmail: typeof saved.formsEmail === 'string' ? saved.formsEmail : '',
      };
    } catch {
      return defaults;
    }
  }

  async set(input: Partial<AgreementSettings>): Promise<AgreementSettings> {
    const current = await this.get();
    const next: AgreementSettings = {
      title: (input.title ?? current.title).trim(),
      body: (input.body ?? current.body).replace(/\r\n/g, '\n').trim(),
      representativeName: (input.representativeName ?? current.representativeName).trim(),
      representativeTitle: (input.representativeTitle ?? current.representativeTitle).trim(),
      formsEmail: (input.formsEmail ?? current.formsEmail).trim().toLowerCase(),
    };
    if (next.formsEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.formsEmail)) throw new BadRequestException('Enter a valid email address for signed forms, or leave it empty.');
    if (!next.title || next.title.length > 150) throw new BadRequestException('Give the agreement a title of up to 150 characters.');
    if (!next.body) throw new BadRequestException('The agreement cannot be empty.');
    if (next.body.length > MAX_BODY_LENGTH) throw new BadRequestException(`The agreement can be up to ${MAX_BODY_LENGTH} characters.`);
    const value = JSON.stringify(next);
    await this.prisma.setting.upsert({ where: { key: SETTINGS_KEY }, create: { key: SETTINGS_KEY, value }, update: { value } });
    return next;
  }
}

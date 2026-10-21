import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, UnsupportedMediaTypeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Decimal } from '@prisma/client/runtime/library';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../auth/auth.service';
import { slugMatchesUsername } from '../billing/advisor-slug';
import { assertPublicUsername, displayNameFromUsername } from '../common/public-identity';
import { MailService, escapeHtml } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { AGREEMENT_ACKNOWLEDGEMENTS, parseAgreement } from './agreement-text';
import { AgreementSettingsService } from './agreement-settings.service';
import { DirectDepositDto, SignAgreementDto, W9Dto } from './onboarding.dto';
import { OnboardingDocumentsService } from './onboarding-documents.service';
import {
  DOCUMENT_LABELS,
  DocumentType,
  MAX_RATE_PER_MINUTE,
  MAX_UPLOAD_BYTES,
  MIN_RATE_PER_MINUTE,
  hashToken,
  isDocumentType,
  sniffFile,
} from './onboarding.constants';
import { buildAgreementPdf } from './pdf/agreement-pdf';
import { buildDirectDepositPdf, isValidRoutingNumber } from './pdf/direct-deposit-pdf';
import { blankW9, fillW9 } from './pdf/w9-pdf';

export type StepKey = 'agreement' | 'w9' | 'displayName' | 'photo' | 'rate' | 'payment';

export interface OnboardingStep {
  key: StepKey;
  label: string;
  done: boolean;
  detail: string | null;
}

/** "Psychic Denise" becomes "psychic_denise": the username that name is shown from. */
export function usernameFromDisplayName(displayName: string): string {
  return displayName
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30)
    .replace(/_+$/g, '');
}

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

/** Whether a nine-digit SSN is one the IRS could have issued (not all zeros in a part, not 666 or 9xx at the start). */
function plausibleSsn(digits: string): boolean {
  const area = digits.slice(0, 3);
  return area !== '000' && area !== '666' && !area.startsWith('9') && digits.slice(3, 5) !== '00' && digits.slice(5) !== '0000';
}

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly docs: OnboardingDocumentsService,
    private readonly agreement: AgreementSettingsService,
    private readonly mail: MailService,
    private readonly auth: AuthService,
  ) {}

  // ── The emailed link ───────────────────────────────────────────────────────

  /** What the link page should show: is it good, used already, or out of date? */
  async checkLink(token: string): Promise<{ state: 'ready' | 'activated' | 'expired' | 'invalid'; name?: string }> {
    const onboarding = await this.prisma.advisorOnboarding.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { activatedAt: true, tokenExpiresAt: true, advisor: { select: { user: { select: { name: true } } } } },
    });
    if (!onboarding) return { state: 'invalid' };
    const name = onboarding.advisor.user.name.split(' ')[0];
    if (onboarding.activatedAt) return { state: 'activated', name };
    if (onboarding.tokenExpiresAt < new Date()) return { state: 'expired', name };
    return { state: 'ready', name };
  }

  /** Sets the advisor's password from the emailed link and signs them in. */
  async activate(token: string, password: string) {
    const onboarding = await this.prisma.advisorOnboarding.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { id: true, activatedAt: true, tokenExpiresAt: true, advisor: { select: { userId: true } } },
    });
    if (!onboarding) throw new BadRequestException('This link is not valid. Ask Support for a new one.');
    if (onboarding.activatedAt) throw new BadRequestException('Your account is already set up. Please sign in.');
    if (onboarding.tokenExpiresAt < new Date()) throw new BadRequestException('This link has expired. Ask Support to send you a new one.');

    const passwordHash = await bcrypt.hash(password, 12);
    // The link is marked used and the password set together, so a failure part-way cannot leave the advisor with a used link
    // and no password. Claiming it first also stops two requests from both setting a password with it.
    await this.prisma.$transaction(async (tx) => {
      const claim = await tx.advisorOnboarding.updateMany({ where: { id: onboarding.id, activatedAt: null }, data: { activatedAt: new Date() } });
      if (claim.count === 0) throw new BadRequestException('Your account is already set up. Please sign in.');
      await tx.user.update({ where: { id: onboarding.advisor.userId }, data: { passwordHash } });
    });
    return this.auth.issueSession(onboarding.advisor.userId);
  }

  // ── The checklist ──────────────────────────────────────────────────────────

  private async load(userId: string) {
    const advisor = await this.prisma.advisorProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        displayName: true,
        phoneNumber: true,
        profileImageUrl: true,
        ratePerMinute: true,
        payoutMethod: true,
        paypalEmail: true,
        bankOnFileAt: true,
        user: { select: { id: true, email: true, name: true, username: true } },
        onboarding: { select: { id: true, activatedAt: true, displayNameChosenAt: true, rateSetAt: true, paymentChosenAt: true, completedAt: true } },
      },
    });
    if (!advisor || !advisor.onboarding) throw new NotFoundException('There is no onboarding for this account.');
    return { ...advisor, onboarding: advisor.onboarding };
  }

  /** The checklist for an advisor, worked out from what has actually been done. */
  async stepsFor(advisorId: string): Promise<{ steps: OnboardingStep[]; completed: boolean }> {
    const advisor = await this.prisma.advisorProfile.findUnique({
      where: { id: advisorId },
      select: {
        displayName: true,
        profileImageUrl: true,
        ratePerMinute: true,
        payoutMethod: true,
        paypalEmail: true,
        onboarding: { select: { displayNameChosenAt: true, rateSetAt: true, paymentChosenAt: true, completedAt: true } },
      },
    });
    if (!advisor?.onboarding) return { steps: [], completed: true };
    const docs = await this.docs.current(advisorId);
    const o = advisor.onboarding;
    const rate = Number(advisor.ratePerMinute);

    const steps: OnboardingStep[] = [
      { key: 'agreement', label: 'Advisor Agreement signed', done: !!docs.AGREEMENT, detail: docs.AGREEMENT ? (docs.AGREEMENT.source === 'ONLINE' ? 'Signed on the site' : 'Signed copy uploaded') : null },
      { key: 'w9', label: 'Signed W-9 submitted', done: !!docs.W9, detail: docs.W9 ? (docs.W9.source === 'ADMIN_UPLOAD' ? 'Signed copy received by email' : 'Signed copy uploaded') : null },
      { key: 'displayName', label: 'Choose your display name', done: !!o.displayNameChosenAt, detail: o.displayNameChosenAt ? advisor.displayName : null },
      { key: 'photo', label: 'Add a profile photo', done: !!advisor.profileImageUrl, detail: advisor.profileImageUrl ? 'Photo added' : null },
      { key: 'rate', label: 'Set your rate per minute', done: !!o.rateSetAt && rate > 0, detail: o.rateSetAt && rate > 0 ? `$${rate.toFixed(2)} per minute` : null },
      {
        key: 'payment',
        label: 'Choose how you are paid',
        done: !!o.paymentChosenAt,
        detail: o.paymentChosenAt ? (advisor.payoutMethod === 'DIRECT_DEPOSIT' ? 'Direct Deposit' : `PayPal: ${advisor.paypalEmail ?? ''}`) : null,
      },
    ];
    return { steps, completed: !!o.completedAt };
  }

  /** Marks onboarding complete (and tells the admins) once every step is done. */
  async refresh(advisorId: string): Promise<boolean> {
    const { steps, completed } = await this.stepsFor(advisorId);
    if (completed) return true;
    if (steps.length === 0 || !steps.every((step) => step.done)) return false;

    const claim = await this.prisma.advisorOnboarding.updateMany({ where: { advisorId, completedAt: null }, data: { completedAt: new Date() } });
    if (claim.count === 1) void this.notifyAdminsCompleted(advisorId);
    return true;
  }

  /** How far along an advisor still in onboarding is, or null if they have none (or it is finished). */
  async progressFor(advisorId: string): Promise<{ done: number; total: number } | null> {
    const { steps, completed } = await this.stepsFor(advisorId);
    if (completed || steps.length === 0) return null;
    return { done: steps.filter((step) => step.done).length, total: steps.length };
  }

  /** For things done outside the checklist (like uploading a profile photo) that may finish it. */
  async refreshForUser(userId: string): Promise<void> {
    const advisor = await this.prisma.advisorProfile.findUnique({ where: { userId }, select: { id: true, onboarding: { select: { id: true } } } });
    if (advisor?.onboarding) await this.refresh(advisor.id);
  }

  /** Advisors still working through onboarding cannot take calls yet. */
  async assertCanGoOnline(userId: string): Promise<void> {
    const advisor = await this.prisma.advisorProfile.findUnique({ where: { userId }, select: { onboarding: { select: { completedAt: true } } } });
    if (advisor?.onboarding && !advisor.onboarding.completedAt) {
      throw new BadRequestException('Finish your onboarding checklist before you go online.');
    }
  }

  async status(userId: string) {
    const advisor = await this.load(userId);
    const [{ steps }, documents, settings] = await Promise.all([this.stepsFor(advisor.id), this.docs.current(advisor.id), this.agreement.get()]);
    // The photo upload happens elsewhere, so finishing the list is checked whenever it is looked at.
    const completed = await this.refresh(advisor.id);

    return {
      completed,
      steps,
      name: advisor.user.name,
      profile: {
        displayName: advisor.displayName,
        username: advisor.user.username,
        ratePerMinute: Number(advisor.ratePerMinute),
        profileImageUrl: advisor.profileImageUrl,
        paymentMethod: advisor.payoutMethod,
        paypalEmail: advisor.paypalEmail,
      },
      formsEmail: settings.formsEmail || null,
      limits: { minRate: MIN_RATE_PER_MINUTE, maxRate: MAX_RATE_PER_MINUTE, maxUploadMb: MAX_UPLOAD_BYTES / (1024 * 1024) },
      documents: Object.fromEntries(
        (Object.keys(documents) as DocumentType[]).map((type) => [
          type,
          documents[type] ? { fileName: documents[type]!.fileName, source: documents[type]!.source, submittedAt: documents[type]!.createdAt } : null,
        ]),
      ),
      agreement: {
        title: settings.title,
        blocks: parseAgreement(settings.body),
        acknowledgements: AGREEMENT_ACKNOWLEDGEMENTS,
        advisor: { name: advisor.user.name, email: advisor.user.email, phone: advisor.phoneNumber ?? '' },
      },
    };
  }

  // ── Steps ──────────────────────────────────────────────────────────────────

  async chooseDisplayName(userId: string, displayName: string) {
    const advisor = await this.load(userId);
    const username = usernameFromDisplayName(displayName);
    assertPublicUsername(username);

    const taken = await this.prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (taken && taken.id !== advisor.user.id) throw new ConflictException('That name is already taken. Please choose another.');

    const current = await this.prisma.advisorProfile.findUnique({ where: { id: advisor.id }, select: { slug: true } });
    const oldUsername = advisor.user.username;
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: advisor.user.id }, data: { username } }),
      this.prisma.advisorProfile.update({
        where: { id: advisor.id },
        data: {
          displayName: displayNameFromUsername(username),
          // The profile link follows the username until onboarding is done, so the name chosen here is the one clients see.
          ...(current?.slug && oldUsername && slugMatchesUsername(current.slug, oldUsername) ? { slug: null } : {}),
        },
      }),
      this.prisma.advisorOnboarding.update({ where: { id: advisor.onboarding.id }, data: { displayNameChosenAt: new Date() } }),
    ]);
    await this.refresh(advisor.id);
    return { displayName: displayNameFromUsername(username), username };
  }

  async setRate(userId: string, ratePerMinute: number) {
    const advisor = await this.load(userId);
    if (ratePerMinute < MIN_RATE_PER_MINUTE || ratePerMinute > MAX_RATE_PER_MINUTE) {
      throw new BadRequestException(`Your rate can be from $${MIN_RATE_PER_MINUTE.toFixed(2)} to $${MAX_RATE_PER_MINUTE.toFixed(2)} per minute.`);
    }
    await this.prisma.$transaction([
      this.prisma.advisorProfile.update({ where: { id: advisor.id }, data: { ratePerMinute: new Decimal(ratePerMinute.toFixed(2)) } }),
      this.prisma.advisorOnboarding.update({ where: { id: advisor.onboarding.id }, data: { rateSetAt: new Date() } }),
    ]);
    await this.refresh(advisor.id);
    return { ratePerMinute };
  }

  /** Chooses PayPal as the way to be paid. (Direct Deposit is chosen by completing the direct deposit form.) */
  async setPaypal(userId: string, email: string) {
    const advisor = await this.load(userId);
    const paypalEmail = email.trim().toLowerCase();
    await this.prisma.$transaction([
      this.prisma.advisorProfile.update({ where: { id: advisor.id }, data: { payoutMethod: 'PAYPAL', paypalEmail } }),
      this.prisma.advisorOnboarding.update({ where: { id: advisor.onboarding.id }, data: { paymentChosenAt: new Date() } }),
    ]);
    await this.refresh(advisor.id);
    return { method: 'PAYPAL', paypalEmail };
  }

  // ── Forms ──────────────────────────────────────────────────────────────────

  /** Signs the Advisor Agreement on the site and stores the signed PDF. */
  async signAgreement(userId: string, dto: SignAgreementDto, ipAddress: string | undefined) {
    const advisor = await this.load(userId);
    if (dto.acknowledgements.length !== AGREEMENT_ACKNOWLEDGEMENTS.length || !dto.acknowledgements.every(Boolean)) {
      throw new BadRequestException('Tick every statement in the acknowledgement to sign.');
    }
    const settings = await this.agreement.get();
    const signedAt = new Date();
    const pdf = await buildAgreementPdf({
      title: settings.title,
      body: settings.body,
      representativeName: settings.representativeName,
      representativeTitle: settings.representativeTitle,
      advisorName: clean(advisor.user.name),
      professionalName: clean(dto.professionalName),
      email: advisor.user.email,
      phone: advisor.phoneNumber ?? '',
      signature: clean(dto.signature),
      signedAt,
      ipAddress,
    });
    await this.docs.save(advisor.id, 'AGREEMENT', 'ONLINE', this.fileName('advisor-agreement', advisor.user.username, 'pdf'), 'application/pdf', pdf);
    await this.refresh(advisor.id);
    return { signedAt };
  }

  /**
   * Fills in the official W-9 from the answers given and hands it back, unsigned, to print. A W-9 has to be signed by hand,
   * so nothing is stored (and the Social Security number goes nowhere) until the advisor uploads, or emails us, the signed copy.
   */
  async fillW9ForPrinting(userId: string, dto: W9Dto): Promise<{ bytes: Uint8Array; fileName: string }> {
    const advisor = await this.load(userId);
    const tin = dto.tin.replace(/[\s-]/g, '');
    if (!/^\d{9}$/.test(tin)) throw new BadRequestException('Enter your 9-digit Social Security number or EIN.');
    if (dto.tinType === 'SSN' && !plausibleSsn(tin)) throw new BadRequestException('That Social Security number does not look right. Please check it.');
    if (dto.tinType === 'EIN' && tin.startsWith('00')) throw new BadRequestException('That EIN does not look right. Please check it.');
    if (dto.classification === 'LLC' && !dto.llcTaxClass) throw new BadRequestException('Choose the LLC tax classification (C, S or P).');
    if (dto.classification === 'OTHER' && !dto.otherClassification?.trim()) throw new BadRequestException('Describe the "Other" tax classification.');

    const bytes = await fillW9({
      name: clean(dto.name),
      businessName: dto.businessName ? clean(dto.businessName) : undefined,
      classification: dto.classification,
      llcTaxClass: dto.llcTaxClass,
      otherClassification: dto.otherClassification ? clean(dto.otherClassification) : undefined,
      foreignPartners: dto.foreignPartners,
      exemptPayeeCode: dto.exemptPayeeCode ? clean(dto.exemptPayeeCode) : undefined,
      fatcaCode: dto.fatcaCode ? clean(dto.fatcaCode) : undefined,
      address: clean(dto.address),
      cityStateZip: clean(dto.cityStateZip),
      accountNumbers: dto.accountNumbers ? clean(dto.accountNumbers) : undefined,
      tinType: dto.tinType,
      tin,
    });
    return { bytes, fileName: this.fileName('W-9-to-sign', advisor.user.username, 'pdf') };
  }

  /** Fills in the direct deposit form, stores it, and makes Direct Deposit the advisor's way of being paid. */
  async submitDirectDeposit(userId: string, dto: DirectDepositDto, ipAddress: string | undefined) {
    const advisor = await this.load(userId);
    if (!dto.authorize) throw new BadRequestException('Tick the authorization to submit the form.');
    const routing = dto.routingNumber.replace(/[\s-]/g, '');
    const account = dto.accountNumber.replace(/[\s-]/g, '');
    const confirm = dto.accountNumberConfirm.replace(/[\s-]/g, '');
    if (!isValidRoutingNumber(routing)) throw new BadRequestException('That routing number is not valid. It is the 9 digits at the bottom left of a check.');
    if (!/^\d{4,17}$/.test(account)) throw new BadRequestException('Enter your account number (4 to 17 digits).');
    if (account !== confirm) throw new BadRequestException('The two account numbers do not match.');

    const pdf = await buildDirectDepositPdf({
      accountHolder: clean(dto.accountHolder),
      bankName: clean(dto.bankName),
      accountType: dto.accountType,
      routingNumber: routing,
      accountNumber: account,
      email: advisor.user.email,
      phone: advisor.phoneNumber ?? '',
      signature: clean(dto.signature),
      signedAt: new Date(),
      ipAddress,
    });
    await this.docs.save(advisor.id, 'DIRECT_DEPOSIT', 'ONLINE', this.fileName('direct-deposit', advisor.user.username, 'pdf'), 'application/pdf', pdf);
    await this.markDirectDeposit(advisor.id, advisor.onboarding.id);
    await this.refresh(advisor.id);
    return { submitted: true };
  }

  /** A completed (and, where needed, signed) form uploaded by the advisor. */
  async upload(userId: string, typeInput: string, file: { buffer?: Buffer; size?: number } | undefined) {
    const advisor = await this.load(userId);
    await this.storeUpload(advisor.id, advisor.onboarding.id, advisor.user.username, this.parseType(typeInput), file, 'UPLOADED');
    return { submitted: true };
  }

  /** The same, added by an admin for an advisor who emailed the signed form instead of uploading it. */
  async uploadForAdvisor(advisorId: string, typeInput: string, file: { buffer?: Buffer; size?: number } | undefined) {
    const advisor = await this.prisma.advisorProfile.findUnique({
      where: { id: advisorId },
      select: { id: true, user: { select: { username: true } }, onboarding: { select: { id: true } } },
    });
    if (!advisor?.onboarding) throw new NotFoundException('This advisor has no onboarding.');
    await this.storeUpload(advisor.id, advisor.onboarding.id, advisor.user.username, this.parseType(typeInput), file, 'ADMIN_UPLOAD');
    return { submitted: true };
  }

  private async storeUpload(
    advisorId: string,
    onboardingId: string,
    username: string | null,
    type: DocumentType,
    file: { buffer?: Buffer } | undefined,
    source: 'UPLOADED' | 'ADMIN_UPLOAD',
  ) {
    if (!file?.buffer || file.buffer.length === 0) throw new BadRequestException('Choose the completed form to upload.');
    if (file.buffer.length > MAX_UPLOAD_BYTES) throw new BadRequestException(`The file can be up to ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`);
    const kind = sniffFile(file.buffer);
    if (!kind) throw new UnsupportedMediaTypeException('Upload a PDF, or a JPG or PNG photo or scan of the completed form.');

    const base = type === 'AGREEMENT' ? 'advisor-agreement' : type === 'W9' ? 'w9-signed' : 'direct-deposit';
    await this.docs.save(advisorId, type, source, this.fileName(`${base}-${source === 'UPLOADED' ? 'uploaded' : 'received'}`, username, kind.extension), kind.mimeType, file.buffer);
    if (type === 'DIRECT_DEPOSIT') await this.markDirectDeposit(advisorId, onboardingId);
    await this.refresh(advisorId);
  }

  /** The blank form to print or fill in outside the site (the agreement, the official W-9, the direct deposit form). */
  async blankForm(typeInput: string): Promise<{ bytes: Uint8Array; fileName: string }> {
    const type = this.parseType(typeInput);
    if (type === 'W9') return { bytes: blankW9(), fileName: 'Form-W-9-blank.pdf' };
    if (type === 'DIRECT_DEPOSIT') return { bytes: await buildDirectDepositPdf(), fileName: 'Direct-Deposit-Authorization-blank.pdf' };
    const settings = await this.agreement.get();
    return {
      bytes: await buildAgreementPdf({
        title: settings.title,
        body: settings.body,
        representativeName: settings.representativeName,
        representativeTitle: settings.representativeTitle,
        advisorName: '',
        professionalName: '',
        email: '',
        phone: '',
      }),
      fileName: 'Advisor-Agreement-blank.pdf',
    };
  }

  /** The advisor's own copy of a form they submitted. */
  async ownDocument(userId: string, typeInput: string) {
    const advisor = await this.load(userId);
    const type = this.parseType(typeInput);
    const current = (await this.docs.current(advisor.id))[type];
    if (!current) throw new NotFoundException(`You have not submitted the ${DOCUMENT_LABELS[type]} yet.`);
    return this.docs.read(current.id, advisor.id);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** A submitted direct deposit form is how the advisor asks to be paid that way: it unlocks and selects Direct Deposit. */
  private async markDirectDeposit(advisorId: string, onboardingId: string) {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.advisorProfile.update({ where: { id: advisorId }, data: { payoutMethod: 'DIRECT_DEPOSIT', bankOnFileAt: now } }),
      this.prisma.advisorOnboarding.update({ where: { id: onboardingId }, data: { paymentChosenAt: now } }),
    ]);
  }

  private parseType(input: string): DocumentType {
    const type = input.toUpperCase().replace(/-/g, '_');
    if (!isDocumentType(type)) throw new NotFoundException('Unknown form');
    return type;
  }

  private fileName(base: string, username: string | null, extension: string): string {
    return `${base}-${(username ?? 'advisor').replace(/[^a-z0-9_-]/gi, '')}.${extension}`;
  }

  private async notifyAdminsCompleted(advisorId: string): Promise<void> {
    try {
      const advisor = await this.prisma.advisorProfile.findUnique({ where: { id: advisorId }, select: { user: { select: { name: true, email: true } } } });
      const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } });
      if (!advisor || admins.length === 0) return;
      const who = escapeHtml(advisor.user.name);
      const base = (this.config.get<string>('WEB_BASE_URL') ?? '').replace(/\/$/, '');
      await this.mail.send({
        to: admins.map((admin) => admin.email),
        subject: `${advisor.user.name} finished advisor onboarding`,
        text: `${advisor.user.name} (${advisor.user.email}) has completed every onboarding step. Review their forms in Admin > Advisor applications${base ? `: ${base}/admin/advisor-applications` : '.'}`,
        html: `<p><strong>${who}</strong> (${escapeHtml(advisor.user.email)}) has completed every onboarding step.</p><p>Review their forms in <strong>Admin &gt; Advisor applications</strong>${base ? `: <a href="${escapeHtml(base)}/admin/advisor-applications">${escapeHtml(base)}/admin/advisor-applications</a>` : '.'}</p>`,
      });
    } catch (error) {
      this.logger.warn(`Could not tell the admins that advisor ${advisorId} finished onboarding: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

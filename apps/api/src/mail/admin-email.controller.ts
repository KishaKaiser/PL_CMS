import { BadRequestException, Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { PreviewEmailDto, SaveEmailSettingsDto, SendTestEmailDto } from './admin-email.dto';
import { EmailComposer } from './email-composer';
import { toPublicEmailSettings, isEmailAddress } from './email-settings';
import { EmailSettingsService } from './email-settings.service';
import { MailService } from './mail.service';

/** The admin Email page: connect the mail account, send a test, preview the emails and see what was sent. */
@Controller('admin/email-settings')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class AdminEmailController {
  constructor(
    private readonly settings: EmailSettingsService,
    private readonly mail: MailService,
    private readonly composer: EmailComposer,
    private readonly prisma: PrismaService,
  ) {}

  private async state() {
    const [settings, effective, siteUrl] = await Promise.all([this.settings.get(), this.settings.getEffective().catch(() => null), this.settings.siteUrl()]);
    return {
      settings: toPublicEmailSettings(settings),
      // "settings" = the account saved here; "environment" = the server's SMTP_* variables; null = email is not set up.
      working: effective?.source ?? null,
      siteUrl,
    };
  }

  @Get()
  find() {
    return this.state();
  }

  @Put()
  async save(@Body() dto: SaveEmailSettingsDto) {
    await this.settings.save(dto);
    return this.state();
  }

  @Post('test')
  async test(@Body() dto: SendTestEmailDto) {
    const to = (dto.to?.trim() || (await this.settings.alertAddress())).trim();
    if (!isEmailAddress(to)) throw new BadRequestException('Enter the email address to send the test to.');
    return this.mail.sendTest(to);
  }

  /** One of the emails with made-up order details, in the saved design (or the design being edited on the page). */
  @Post('preview')
  async preview(@Body() dto: PreviewEmailDto) {
    const base = (await this.settings.siteUrl()) || 'https://example.com';
    const title = (await this.settings.siteTitle()) || 'your shop';
    const values = {
      customerName: 'Alex',
      customerEmail: 'alex@example.com',
      orderId: 'clx9sample1234567890',
      orderShort: 'clx9sample12',
      orderItems: '• 2 × Cat Candle (Green on top, White below) — $40.00\n• 1 × Lavender Soap — $14.00',
      total: '$54.00',
      shipTo: 'Alex Example\n1 Candle Lane\nAustin, TX 78701\nUS',
      stage: 'being packaged',
      carrier: 'USPS',
      trackingNumber: '9400 1118 9922 3197 4284 90',
      trackingUrl: `${base}/client/orders/clx9sample1234567890`,
      formTitle: 'Contact us',
      fields: 'Name: Alex\nEmail: alex@example.com\nMessage: Hello! I have a question about a custom candle.',
    };
    const toCustomer = dto.template === 'order_confirmation' || dto.template === 'order_progress' || dto.template === 'order_shipped';
    const email = await this.composer.compose(dto.template, values, {
      customer: toCustomer,
      button: toCustomer
        ? { url: values.trackingUrl }
        : dto.template === 'order_alert'
          ? { url: `${base}/admin/orders/clx9sample1234567890`, label: 'Open the order' }
          : { url: `${base}/admin/forms`, label: 'See all submissions' },
      defaultFooter: `You are receiving this because you placed an order at ${title}.`,
      design: dto.design,
    });
    if (!email) throw new BadRequestException('That email does not exist.');
    return { subject: email.subject, html: email.html };
  }

  @Get('log')
  log() {
    return this.prisma.emailLog.findMany({ orderBy: { createdAt: 'desc' }, take: 30 });
  }
}

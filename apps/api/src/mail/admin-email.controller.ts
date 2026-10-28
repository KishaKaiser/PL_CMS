import { BadRequestException, Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { SaveEmailSettingsDto, SendTestEmailDto } from './admin-email.dto';
import { toPublicEmailSettings, isEmailAddress } from './email-settings';
import { EmailSettingsService } from './email-settings.service';
import { MailService } from './mail.service';

/** The admin Email page: connect the mail account, send a test, and see what was sent. */
@Controller('admin/email-settings')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class AdminEmailController {
  constructor(
    private readonly settings: EmailSettingsService,
    private readonly mail: MailService,
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

  @Get('log')
  log() {
    return this.prisma.emailLog.findMany({ orderBy: { createdAt: 'desc' }, take: 30 });
  }
}

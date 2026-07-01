import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { NewsletterSettingsDto, SubscribeDto } from './newsletter.dto';
import { NewsletterService } from './newsletter.service';

@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Post('subscribe')
  subscribe(@Body() dto: SubscribeDto) {
    return this.newsletterService.subscribe(dto);
  }

  @Get('settings')
  settings() {
    return this.newsletterService.getSettings();
  }

  @Get('admin/subscribers')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  subscribers() {
    return this.newsletterService.listSubscribers();
  }

  @Get('admin/export')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  exportSubscribers() {
    return this.newsletterService.exportSubscribers();
  }

  @Get('admin/settings')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  adminSettings() {
    return this.newsletterService.getSettings();
  }

  @Put('admin/settings')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  saveSettings(@Body() dto: NewsletterSettingsDto) {
    return this.newsletterService.saveSettings(dto);
  }

  @Post('admin/subscribers/:email/unsubscribe')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  unsubscribe(@Param('email') email: string) {
    return this.newsletterService.unsubscribe(decodeURIComponent(email));
  }

  @Delete('admin/subscribers/:email')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  deleteSubscriber(@Param('email') email: string) {
    return this.newsletterService.deleteSubscriber(decodeURIComponent(email));
  }
}

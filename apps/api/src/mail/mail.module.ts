import { Module } from '@nestjs/common';
import { AdminEmailController } from './admin-email.controller';
import { EmailSettingsService } from './email-settings.service';
import { MailService } from './mail.service';
import { OrderEmailService } from './order-emails.service';

@Module({
  controllers: [AdminEmailController],
  providers: [EmailSettingsService, MailService, OrderEmailService],
  exports: [MailService, EmailSettingsService, OrderEmailService],
})
export class MailModule {}

import { Module } from '@nestjs/common';
import { AdminEmailController } from './admin-email.controller';
import { EmailComposer } from './email-composer';
import { EmailSettingsService } from './email-settings.service';
import { MailService } from './mail.service';
import { OrderEmailService } from './order-emails.service';

@Module({
  controllers: [AdminEmailController],
  providers: [EmailSettingsService, MailService, EmailComposer, OrderEmailService],
  exports: [MailService, EmailSettingsService, EmailComposer, OrderEmailService],
})
export class MailModule {}

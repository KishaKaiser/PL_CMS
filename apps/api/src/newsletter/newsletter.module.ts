import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [NewsletterController],
  providers: [NewsletterService],
})
export class NewsletterModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AgreementSettingsService } from './agreement-settings.service';
import { ApplicationsService } from './applications.service';
import { OnboardingMeController, OnboardingPublicController } from './onboarding.controller';
import { OnboardingDocumentsService } from './onboarding-documents.service';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [PrismaModule, MailModule, AuthModule],
  controllers: [OnboardingPublicController, OnboardingMeController],
  providers: [AgreementSettingsService, OnboardingDocumentsService, OnboardingService, ApplicationsService],
  exports: [AgreementSettingsService, OnboardingDocumentsService, OnboardingService, ApplicationsService],
})
export class OnboardingModule {}

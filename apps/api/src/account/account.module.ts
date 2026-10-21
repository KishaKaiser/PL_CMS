import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AstrologyModule } from '../astrology/astrology.module';
import { FreeMinutesModule } from '../free-minutes/free-minutes.module';
import { MessagesModule } from '../messages/messages.module';
import { OnboardingModule } from '../onboarding/onboarding.module';

@Module({
  imports: [AstrologyModule, MessagesModule, FreeMinutesModule, OnboardingModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}

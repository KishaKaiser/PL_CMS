import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AstrologyModule } from '../astrology/astrology.module';
import { FreeMinutesModule } from '../free-minutes/free-minutes.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [AstrologyModule, MessagesModule, FreeMinutesModule, PayoutsModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}

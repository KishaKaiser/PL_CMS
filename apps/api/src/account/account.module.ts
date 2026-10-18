import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AstrologyModule } from '../astrology/astrology.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [AstrologyModule, MessagesModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}

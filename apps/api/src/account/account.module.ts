import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AstrologyModule } from '../astrology/astrology.module';

@Module({
  imports: [AstrologyModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}

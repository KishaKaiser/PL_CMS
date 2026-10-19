import { Module } from '@nestjs/common';
import { FreeMinutesModule } from '../free-minutes/free-minutes.module';
import { TelephonyModule } from '../telephony/telephony.module';
import { WalletModule } from '../wallet/wallet.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PhoneController } from './phone.controller';
import { PhoneService } from './phone.service';

@Module({
  imports: [TelephonyModule, WalletModule, FreeMinutesModule],
  controllers: [BillingController, PhoneController],
  providers: [BillingService, PhoneService],
  exports: [BillingService],
})
export class BillingModule {}

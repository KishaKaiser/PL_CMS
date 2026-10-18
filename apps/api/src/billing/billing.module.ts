import { Module } from '@nestjs/common';
import { TelephonyModule } from '../telephony/telephony.module';
import { WalletModule } from '../wallet/wallet.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PhoneController } from './phone.controller';
import { PhoneService } from './phone.service';

@Module({
  imports: [TelephonyModule, WalletModule],
  controllers: [BillingController, PhoneController],
  providers: [BillingService, PhoneService],
  exports: [BillingService],
})
export class BillingModule {}

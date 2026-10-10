import { Module } from '@nestjs/common';
import { TelephonyModule } from '../telephony/telephony.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PhoneController } from './phone.controller';
import { PhoneService } from './phone.service';

@Module({
  imports: [TelephonyModule],
  controllers: [BillingController, PhoneController],
  providers: [BillingService, PhoneService],
})
export class BillingModule {}

import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { CallbacksModule } from '../callbacks/callbacks.module';
import { TelephonyModule } from '../telephony/telephony.module';
import { HotlineService } from './hotline.service';

@Module({
  imports: [BillingModule, CallbacksModule, TelephonyModule],
  providers: [HotlineService],
})
export class HotlineModule {}

import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { PaypalAdminController } from './paypal-admin.controller';
import { PaypalService } from './paypal.service';
import { StoreModule } from '../store/store.module';
import { AstrologyModule } from '../astrology/astrology.module';

@Module({
  imports: [StoreModule, AstrologyModule],
  controllers: [CheckoutController, PaypalAdminController],
  providers: [CheckoutService, PaypalService],
  exports: [PaypalService],
})
export class CheckoutModule {}

import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { PaypalService } from './paypal.service';

@Module({
  controllers: [CheckoutController],
  providers: [CheckoutService, PaypalService],
  exports: [PaypalService],
})
export class CheckoutModule {}

import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { PaypalService } from './paypal.service';
import { StoreModule } from '../store/store.module';

@Module({
  imports: [StoreModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, PaypalService],
  exports: [PaypalService],
})
export class CheckoutModule {}

import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { PaypalAdminController } from './paypal-admin.controller';
import { PaypalService } from './paypal.service';
import { StoreModule } from '../store/store.module';
import { AstrologyModule } from '../astrology/astrology.module';
import { CandlesModule } from '../candles/candles.module';
import { MailModule } from '../mail/mail.module';
import { FreeMinutesModule } from '../free-minutes/free-minutes.module';
import { OrderHoldsService } from './order-holds.service';

@Module({
  imports: [StoreModule, AstrologyModule, CandlesModule, MailModule, FreeMinutesModule],
  controllers: [CheckoutController, PaypalAdminController],
  providers: [CheckoutService, PaypalService, OrderHoldsService],
  exports: [PaypalService, OrderHoldsService],
})
export class CheckoutModule {}

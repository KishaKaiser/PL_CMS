import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { CheckoutModule } from '../checkout/checkout.module';
import { MailModule } from '../mail/mail.module';
import { FreeMinutesModule } from '../free-minutes/free-minutes.module';

@Module({
  imports: [CheckoutModule, MailModule, FreeMinutesModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}

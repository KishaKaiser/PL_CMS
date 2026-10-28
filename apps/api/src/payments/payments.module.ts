import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { CheckoutModule } from '../checkout/checkout.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [CheckoutModule, MailModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}

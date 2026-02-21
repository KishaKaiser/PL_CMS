import { Module } from '@nestjs/common';
import { FulfillmentController } from './fulfillment.controller';
import { FulfillmentService } from './fulfillment.service';
import { EmailService } from './email.service';

@Module({
  controllers: [FulfillmentController],
  providers: [FulfillmentService, EmailService],
  exports: [FulfillmentService],
})
export class FulfillmentModule {}

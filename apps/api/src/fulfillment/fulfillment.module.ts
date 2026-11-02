import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { FulfillmentController } from './fulfillment.controller';
import { OrderLookupController } from './order-lookup.controller';
import { OrderTrackingController } from './order-tracking.controller';
import { ShipStationCustomStoreController } from './shipstation-custom-store.controller';
import { FulfillmentService } from './fulfillment.service';
import { OrderTrackingService } from './order-tracking.service';
import { ShipStationCustomStoreService } from './shipstation-custom-store.service';
import { ShipStationTrackingService } from './shipstation-tracking.service';
import { EmailService } from './email.service';

@Module({
  imports: [MailModule],
  controllers: [FulfillmentController, ShipStationCustomStoreController, OrderTrackingController, OrderLookupController],
  providers: [
    FulfillmentService,
    ShipStationCustomStoreService,
    EmailService,
    ShipStationTrackingService,
    OrderTrackingService,
  ],
  exports: [FulfillmentService, ShipStationCustomStoreService],
})
export class FulfillmentModule {}

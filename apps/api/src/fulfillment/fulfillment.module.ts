import { Module } from '@nestjs/common';
import { FulfillmentController } from './fulfillment.controller';
import { OrderTrackingController } from './order-tracking.controller';
import { ShipStationCustomStoreController } from './shipstation-custom-store.controller';
import { FulfillmentService } from './fulfillment.service';
import { OrderTrackingService } from './order-tracking.service';
import { ShipStationCustomStoreService } from './shipstation-custom-store.service';
import { ShipStationTrackingService } from './shipstation-tracking.service';
import { EmailService } from './email.service';

@Module({
  controllers: [FulfillmentController, ShipStationCustomStoreController, OrderTrackingController],
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

import { Module } from '@nestjs/common';
import { FulfillmentController } from './fulfillment.controller';
import { ShipStationCustomStoreController } from './shipstation-custom-store.controller';
import { FulfillmentService } from './fulfillment.service';
import { ShipStationCustomStoreService } from './shipstation-custom-store.service';
import { EmailService } from './email.service';

@Module({
  controllers: [FulfillmentController, ShipStationCustomStoreController],
  providers: [FulfillmentService, ShipStationCustomStoreService, EmailService],
  exports: [FulfillmentService, ShipStationCustomStoreService],
})
export class FulfillmentModule {}

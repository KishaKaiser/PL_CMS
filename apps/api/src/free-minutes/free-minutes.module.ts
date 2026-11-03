import { Module } from '@nestjs/common';
import { CheckoutModule } from '../checkout/checkout.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminFreeMinutesController, FreeMinutesController } from './free-minutes.controller';
import { FreeMinutesService } from './free-minutes.service';

@Module({
  imports: [PrismaModule, CheckoutModule],
  controllers: [FreeMinutesController, AdminFreeMinutesController],
  providers: [FreeMinutesService],
  exports: [FreeMinutesService],
})
export class FreeMinutesModule {}

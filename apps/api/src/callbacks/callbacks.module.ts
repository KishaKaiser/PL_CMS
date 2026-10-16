import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { CallbacksController } from './callbacks.controller';
import { CallbacksService } from './callbacks.service';

@Module({
  imports: [BillingModule],
  controllers: [CallbacksController],
  providers: [CallbacksService],
})
export class CallbacksModule {}

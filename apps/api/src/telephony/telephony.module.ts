import { Module } from '@nestjs/common';
import { TelnyxService } from './telnyx.service';

@Module({
  providers: [TelnyxService],
  exports: [TelnyxService],
})
export class TelephonyModule {}

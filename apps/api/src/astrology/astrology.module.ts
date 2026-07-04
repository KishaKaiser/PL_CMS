import { Module } from '@nestjs/common';
import { AstrologyReportsService } from './astrology-reports.service';

@Module({
  providers: [AstrologyReportsService],
  exports: [AstrologyReportsService],
})
export class AstrologyModule {}

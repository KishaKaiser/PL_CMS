import { Module } from '@nestjs/common';
import { AstrologyReportsService } from './astrology-reports.service';
import { OllamaClient } from './ollama-client';

@Module({
  providers: [AstrologyReportsService, OllamaClient],
  exports: [AstrologyReportsService],
})
export class AstrologyModule {}

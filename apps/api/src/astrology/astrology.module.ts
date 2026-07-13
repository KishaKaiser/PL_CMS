import { Module } from '@nestjs/common';
import { AstrologyController } from './astrology.controller';
import { AstrologyReportsService } from './astrology-reports.service';
import { OllamaClient } from './ollama-client';

@Module({
  controllers: [AstrologyController],
  providers: [AstrologyReportsService, OllamaClient],
  exports: [AstrologyReportsService],
})
export class AstrologyModule {}

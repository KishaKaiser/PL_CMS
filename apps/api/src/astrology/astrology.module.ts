import { Module } from '@nestjs/common';
import { AstrologyController } from './astrology.controller';
import { AstrologyBlogController } from './astrology-blog.controller';
import { AstrologyBlogService } from './astrology-blog.service';
import { AstrologyChartsController } from './astrology-charts.controller';
import { AstrologyChartsService } from './astrology-charts.service';
import { AstrologyOrdersController } from './astrology-orders.controller';
import { AstrologyReportsService } from './astrology-reports.service';
import { HoroscopeController } from './horoscope.controller';
import { HoroscopeService } from './horoscope.service';
import { OllamaClient } from './ollama-client';

@Module({
  controllers: [
    AstrologyController,
    AstrologyChartsController,
    AstrologyOrdersController,
    AstrologyBlogController,
    HoroscopeController,
  ],
  providers: [AstrologyReportsService, AstrologyChartsService, AstrologyBlogService, HoroscopeService, OllamaClient],
  exports: [AstrologyReportsService, AstrologyChartsService, HoroscopeService],
})
export class AstrologyModule {}

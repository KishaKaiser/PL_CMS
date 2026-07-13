import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AstrologyController } from './astrology.controller';
import { AstrologyBlogController } from './astrology-blog.controller';
import { AstrologyBlogService } from './astrology-blog.service';
import { AstrologyChartsController } from './astrology-charts.controller';
import { AstrologyChartsService } from './astrology-charts.service';
import { AstrologyReportsService } from './astrology-reports.service';
import { OllamaClient } from './ollama-client';

@Module({
  imports: [AdminModule],
  controllers: [AstrologyController, AstrologyChartsController, AstrologyBlogController],
  providers: [AstrologyReportsService, AstrologyChartsService, AstrologyBlogService, OllamaClient],
  exports: [AstrologyReportsService, AstrologyChartsService],
})
export class AstrologyModule {}

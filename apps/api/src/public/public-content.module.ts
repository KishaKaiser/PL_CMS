import { Module } from '@nestjs/common';
import { AstrologyModule } from '../astrology/astrology.module';
import { AdminSiteDefaultsController } from './admin-site-defaults.controller';
import { PublicContentController } from './public-content.controller';
import { PublicContentService } from './public-content.service';

@Module({
  imports: [AstrologyModule],
  controllers: [PublicContentController, AdminSiteDefaultsController],
  providers: [PublicContentService],
})
export class PublicContentModule {}

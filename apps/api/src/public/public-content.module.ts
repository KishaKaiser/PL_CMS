import { Module } from '@nestjs/common';
import { AstrologyModule } from '../astrology/astrology.module';
import { PublicContentController } from './public-content.controller';
import { PublicContentService } from './public-content.service';

@Module({
  imports: [AstrologyModule],
  controllers: [PublicContentController],
  providers: [PublicContentService],
})
export class PublicContentModule {}

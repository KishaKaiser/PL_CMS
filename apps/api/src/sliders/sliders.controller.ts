import { Controller, Get, Param } from '@nestjs/common';
import { SlidersService } from './sliders.service';

@Controller('sliders')
export class SlidersController {
  constructor(private readonly slidersService: SlidersService) {}

  @Get(':slug')
  findPublished(@Param('slug') slug: string) {
    return this.slidersService.findPublishedBySlug(slug);
  }
}

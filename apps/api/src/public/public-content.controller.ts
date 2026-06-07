import { Controller, Get, Param, Query } from '@nestjs/common';
import { PublicContentService } from './public-content.service';

@Controller('public')
export class PublicContentController {
  constructor(private readonly publicContentService: PublicContentService) {}

  @Get('pages')
  findPages(@Query('excludeSlug') excludeSlug?: string) {
    return this.publicContentService.findPublishedPages(excludeSlug);
  }

  @Get('pages/:slug')
  findPageBySlug(@Param('slug') slug: string) {
    return this.publicContentService.findPublishedPageBySlug(slug);
  }

  @Get('posts')
  findPosts() {
    return this.publicContentService.findPublishedPosts();
  }

  @Get('posts/:slug')
  findPostBySlug(@Param('slug') slug: string) {
    return this.publicContentService.findPublishedPostBySlug(slug);
  }
}

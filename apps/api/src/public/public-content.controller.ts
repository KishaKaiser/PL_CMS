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
  findPosts(
    @Query('search') search?: string,
    @Query('category') categorySlug?: string,
    @Query('tag') tagSlug?: string,
    @Query('authorId') authorId?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.publicContentService.findPublishedPosts({
      search,
      categorySlug,
      tagSlug,
      authorId,
      year,
      month,
    });
  }

  @Get('posts/:slug/related')
  findRelatedPosts(@Param('slug') slug: string) {
    return this.publicContentService.findRelatedPosts(slug);
  }

  @Get('posts/:slug')
  findPostBySlug(@Param('slug') slug: string) {
    return this.publicContentService.findPublishedPostBySlug(slug);
  }

  @Get('categories')
  findCategories() {
    return this.publicContentService.findCategories();
  }

  @Get('categories/:slug/posts')
  findPostsByCategory(@Param('slug') slug: string) {
    return this.publicContentService.findPostsByCategorySlug(slug);
  }

  @Get('tags')
  findTags() {
    return this.publicContentService.findTags();
  }

  @Get('tags/:slug/posts')
  findPostsByTag(@Param('slug') slug: string) {
    return this.publicContentService.findPostsByTagSlug(slug);
  }

  @Get('authors')
  findAuthors() {
    return this.publicContentService.findAuthors();
  }

  @Get('authors/:authorId/posts')
  findPostsByAuthor(@Param('authorId') authorId: string) {
    return this.publicContentService.findPostsByAuthorId(authorId);
  }

  @Get('archives')
  findArchives() {
    return this.publicContentService.findArchives();
  }
}

import { Controller, Get, Param, Query } from '@nestjs/common';
import { PublicContentService } from './public-content.service';
import {
  PublicAuthorParamDto,
  PublicPagesQueryDto,
  PublicPostsQueryDto,
  PublicSlugParamDto,
} from './public-content.dto';

@Controller('public')
export class PublicContentController {
  constructor(private readonly publicContentService: PublicContentService) {}

  @Get('site-config')
  getSiteConfig() {
    return this.publicContentService.getSiteConfig();
  }

  @Get('pages')
  findPages(@Query() query: PublicPagesQueryDto) {
    return this.publicContentService.findPublishedPages(query.excludeSlug);
  }

  @Get('pages/:slug')
  findPageBySlug(@Param() params: PublicSlugParamDto) {
    return this.publicContentService.findPublishedPageBySlug(params.slug);
  }

  @Get('pages/:slug/redirect')
  findPageRedirectBySlug(@Param() params: PublicSlugParamDto) {
    return this.publicContentService.findPageRedirectBySlug(params.slug);
  }

  @Get('posts')
  findPosts(@Query() query: PublicPostsQueryDto) {
    return this.publicContentService.findPublishedPosts({
      search: query.search,
      categorySlug: query.category,
      tagSlug: query.tag,
      authorId: query.authorId,
      year: query.year?.toString(),
      month: query.month?.toString(),
    });
  }

  @Get('posts/:slug/related')
  findRelatedPosts(@Param() params: PublicSlugParamDto) {
    return this.publicContentService.findRelatedPosts(params.slug);
  }

  @Get('posts/:slug')
  findPostBySlug(@Param() params: PublicSlugParamDto) {
    return this.publicContentService.findPublishedPostBySlug(params.slug);
  }

  @Get('posts/:slug/redirect')
  findPostRedirectBySlug(@Param() params: PublicSlugParamDto) {
    return this.publicContentService.findPostRedirectBySlug(params.slug);
  }

  @Get('categories')
  findCategories() {
    return this.publicContentService.findCategories();
  }

  @Get('categories/:slug/posts')
  findPostsByCategory(@Param() params: PublicSlugParamDto) {
    return this.publicContentService.findPostsByCategorySlug(params.slug);
  }

  @Get('tags')
  findTags() {
    return this.publicContentService.findTags();
  }

  @Get('tags/:slug/posts')
  findPostsByTag(@Param() params: PublicSlugParamDto) {
    return this.publicContentService.findPostsByTagSlug(params.slug);
  }

  @Get('authors')
  findAuthors() {
    return this.publicContentService.findAuthors();
  }

  @Get('authors/:authorId/posts')
  findPostsByAuthor(@Param() params: PublicAuthorParamDto) {
    return this.publicContentService.findPostsByAuthorId(params.authorId);
  }

  @Get('archives')
  findArchives() {
    return this.publicContentService.findArchives();
  }
}

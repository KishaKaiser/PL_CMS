import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { HoroscopePeriodDto } from '../astrology/horoscope.dto';
import { PublicContentService } from './public-content.service';
import {
  CreatePostCommentDto,
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

  @Get('horoscopes')
  getHoroscopes(@Query() query: HoroscopePeriodDto) {
    return this.publicContentService.findCurrentHoroscopes(query.year, query.month);
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

  @Get('posts/:slug/comments')
  findPostComments(@Param() params: PublicSlugParamDto) {
    return this.publicContentService.findPostComments(params.slug);
  }

  @Post('posts/:slug/comments')
  @UseGuards(AuthGuard('jwt'))
  createPostComment(
    @Param() params: PublicSlugParamDto,
    @Request() req: { user: { id: string } },
    @Body() dto: CreatePostCommentDto,
  ) {
    return this.publicContentService.createPostComment(params.slug, req.user.id, dto);
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

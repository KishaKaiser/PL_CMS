import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { PostsService } from '../admin/admin-posts/posts.service';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { GenerateBlogPostDto, PublishBlogPostDto } from './astrology-blog.dto';
import { AstrologyBlogService } from './astrology-blog.service';

@Controller('astrology/blog')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.EDITOR)
export class AstrologyBlogController {
  constructor(
    private readonly blogService: AstrologyBlogService,
    private readonly postsService: PostsService,
  ) {}

  @Post('generate')
  generate(@Body() dto: GenerateBlogPostDto) {
    return this.blogService.generateBlogPost(dto.transitType, dto.additionalContext);
  }

  @Post('publish')
  publish(@Body() dto: PublishBlogPostDto) {
    return this.postsService.create({
      slug: dto.slug,
      title: dto.title,
      content: paragraphsToHtml(dto.content),
      authorId: dto.authorId,
      publishedAt: dto.publishedAt ?? null,
    });
  }
}

function paragraphsToHtml(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

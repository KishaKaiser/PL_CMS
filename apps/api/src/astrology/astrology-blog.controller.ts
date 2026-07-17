import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { GenerateBlogPostDto } from './astrology-blog.dto';
import { AstrologyBlogService } from './astrology-blog.service';

@Controller('astrology/blog')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.EDITOR)
export class AstrologyBlogController {
  constructor(private readonly blogService: AstrologyBlogService) {}

  @Post('generate')
  generate(@Body() dto: GenerateBlogPostDto) {
    return this.blogService.generateBlogPost(dto);
  }
}

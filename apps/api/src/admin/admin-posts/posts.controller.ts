import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles } from '../../auth/roles.guard';
import { Role } from '@pl-cms/shared';
import { PostsService } from './posts.service';
import { CreatePostDto, UpdatePostDto } from './posts.dto';

@Controller('posts')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get() findAll() { return this.postsService.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.postsService.findOne(id); }
  @Post() create(@Body() dto: CreatePostDto) { return this.postsService.create(dto); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdatePostDto) { return this.postsService.update(id, dto); }
  @Patch(':id/publish') publish(@Param('id') id: string) { return this.postsService.publish(id); }
  @Patch(':id/unpublish') unpublish(@Param('id') id: string) { return this.postsService.unpublish(id); }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) remove(@Param('id') id: string) { return this.postsService.remove(id); }
}

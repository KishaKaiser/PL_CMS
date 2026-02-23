import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles } from '../../auth/roles.guard';
import { Role } from '@pl-cms/shared';
import { PagesService } from './pages.service';
import { CreatePageDto, UpdatePageDto } from './pages.dto';

@Controller('pages')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Get() findAll() { return this.pagesService.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.pagesService.findOne(id); }
  @Post() create(@Body() dto: CreatePageDto) { return this.pagesService.create(dto); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdatePageDto) { return this.pagesService.update(id, dto); }
  @Patch(':id/publish') publish(@Param('id') id: string) { return this.pagesService.publish(id); }
  @Patch(':id/unpublish') unpublish(@Param('id') id: string) { return this.pagesService.unpublish(id); }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) remove(@Param('id') id: string) { return this.pagesService.remove(id); }
}

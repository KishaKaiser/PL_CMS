import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { TaxonomiesService } from './taxonomies.service';
import { CreateTaxonomyDto, UpdateTaxonomyDto } from './taxonomies.dto';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class TaxonomiesController {
  constructor(private readonly taxonomiesService: TaxonomiesService) {}

  @Get('categories')
  findAllCategories() {
    return this.taxonomiesService.findAllCategories();
  }

  @Post('categories')
  createCategory(@Body() dto: CreateTaxonomyDto) {
    return this.taxonomiesService.createCategory(dto);
  }

  @Put('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateTaxonomyDto) {
    return this.taxonomiesService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  removeCategory(@Param('id') id: string) {
    return this.taxonomiesService.removeCategory(id);
  }

  @Get('tags')
  findAllTags() {
    return this.taxonomiesService.findAllTags();
  }

  @Post('tags')
  createTag(@Body() dto: CreateTaxonomyDto) {
    return this.taxonomiesService.createTag(dto);
  }

  @Put('tags/:id')
  updateTag(@Param('id') id: string, @Body() dto: UpdateTaxonomyDto) {
    return this.taxonomiesService.updateTag(id, dto);
  }

  @Delete('tags/:id')
  removeTag(@Param('id') id: string) {
    return this.taxonomiesService.removeTag(id);
  }
}

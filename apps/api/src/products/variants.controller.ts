import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { VariantsService } from './variants.service';
import { CreateVariantDto, UpdateVariantDto, UpdateInventoryDto } from './variants.dto';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { Role } from '@pl-cms/shared';

@Controller('products/:productId/variants')
export class VariantsController {
  constructor(private readonly variantsService: VariantsService) {}

  /** Public: list active variants for a product */
  @Get()
  findAll(@Param('productId') productId: string) {
    return this.variantsService.findByProduct(productId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.variantsService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  create(
    @Param('productId') productId: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.variantsService.create(productId, dto);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  update(
    @Param('productId') productId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.variantsService.update(productId, id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('productId') productId: string, @Param('id') id: string) {
    return this.variantsService.remove(productId, id);
  }

  @Put(':id/inventory')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  updateInventory(
    @Param('id') id: string,
    @Body() dto: UpdateInventoryDto,
  ) {
    return this.variantsService.updateInventory(id, dto);
  }
}

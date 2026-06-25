import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProductsService } from './products.service';
import { CreateProductDto, CreateProductReviewDto, ImportProductsDto, UpdateProductDto } from './products.dto';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { Role } from '@pl-cms/shared';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /** Public: list active products for shop */
  @Get()
  findActive() {
    return this.productsService.findActive();
  }

  /** Admin: list all products */
  @Get('all')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Get(':id/reviews')
  listReviews(@Param('id') id: string) {
    return this.productsService.listReviews(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Post('import')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  importProducts(@Body() dto: ImportProductsDto) {
    return this.productsService.importProducts(dto.items);
  }

  @Post(':id/reviews')
  @UseGuards(AuthGuard('jwt'))
  createReview(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateProductReviewDto,
  ) {
    return this.productsService.createReview(id, req.user.id, dto);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}

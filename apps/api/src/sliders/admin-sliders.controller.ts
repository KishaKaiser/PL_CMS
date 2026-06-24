import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CreateSliderDto, UpdateSliderDto } from './sliders.dto';
import { SlidersService } from './sliders.service';

@Controller('admin/sliders')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.EDITOR)
export class AdminSlidersController {
  constructor(private readonly slidersService: SlidersService) {}

  @Get()
  findAll() {
    return this.slidersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.slidersService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateSliderDto) {
    return this.slidersService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSliderDto) {
    return this.slidersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.slidersService.remove(id);
  }
}

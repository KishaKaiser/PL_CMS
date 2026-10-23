import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CandlesService } from './candles.service';
import { SaveCandleColorDto, SaveCandleHerbDto, SaveCandleTypeDto } from './candles.dto';

/** Public: what the custom candle page offers. */
@Controller('candles')
export class CandlesController {
  constructor(private readonly candles: CandlesService) {}

  @Get('config')
  getConfig() {
    return this.candles.getPublicConfig();
  }
}

/** Admin: manage the candle types, heights, colors and herbs. */
@Controller('admin/candles')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class AdminCandlesController {
  constructor(private readonly candles: CandlesService) {}

  @Get()
  overview() {
    return this.candles.getAdminOverview();
  }

  @Post('types')
  createType(@Body() dto: SaveCandleTypeDto) {
    return this.candles.createType(dto);
  }

  @Put('types/:id')
  updateType(@Param('id') id: string, @Body() dto: SaveCandleTypeDto) {
    return this.candles.updateType(id, dto);
  }

  @Delete('types/:id')
  deleteType(@Param('id') id: string) {
    return this.candles.deleteType(id);
  }

  @Post('colors')
  createColor(@Body() dto: SaveCandleColorDto) {
    return this.candles.createColor(dto);
  }

  @Put('colors/:id')
  updateColor(@Param('id') id: string, @Body() dto: SaveCandleColorDto) {
    return this.candles.updateColor(id, dto);
  }

  @Delete('colors/:id')
  deleteColor(@Param('id') id: string) {
    return this.candles.deleteColor(id);
  }

  @Post('herbs')
  createHerb(@Body() dto: SaveCandleHerbDto) {
    return this.candles.createHerb(dto);
  }

  @Put('herbs/:id')
  updateHerb(@Param('id') id: string, @Body() dto: SaveCandleHerbDto) {
    return this.candles.updateHerb(id, dto);
  }

  @Delete('herbs/:id')
  deleteHerb(@Param('id') id: string) {
    return this.candles.deleteHerb(id);
  }
}

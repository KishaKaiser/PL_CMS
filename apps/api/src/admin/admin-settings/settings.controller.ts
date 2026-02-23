import { Controller, Get, Put, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles } from '../../auth/roles.guard';
import { Role } from '@pl-cms/shared';
import { SettingsService } from './settings.service';
import { UpsertSettingDto } from './settings.dto';

@Controller('settings')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get() findAll() { return this.settingsService.findAll(); }
  @Get(':key') findOne(@Param('key') key: string) { return this.settingsService.findOne(key); }
  @Put(':key') upsert(@Param('key') key: string, @Body() dto: UpsertSettingDto) { return this.settingsService.upsert(key, dto); }
  @Delete(':key') @HttpCode(HttpStatus.NO_CONTENT) remove(@Param('key') key: string) { return this.settingsService.remove(key); }
}

import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { HoroscopePeriodDto, UpdateHoroscopeDto } from './horoscope.dto';
import { HoroscopeService } from './horoscope.service';

@Controller('astrology/horoscopes')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.EDITOR)
export class HoroscopeController {
  constructor(private readonly horoscopeService: HoroscopeService) {}

  @Get()
  list(@Query() query: HoroscopePeriodDto) {
    const now = new Date();
    const year = query.year ?? now.getFullYear();
    const month = query.month ?? now.getMonth() + 1;
    return this.horoscopeService.listForMonth(year, month);
  }

  /** Kicks off generation in the background and returns immediately — 12 sequential Ollama
   *  calls can take minutes, well past the proxy's request timeout if awaited here. */
  @Post('generate')
  generate(@Body() dto: HoroscopePeriodDto) {
    const now = new Date();
    const year = dto.year ?? now.getFullYear();
    const month = dto.month ?? now.getMonth() + 1;
    void this.horoscopeService.generateAllSigns(year, month).catch(() => undefined);
    return { status: 'started', year, month };
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateHoroscopeDto) {
    return this.horoscopeService.updateSection(id, dto);
  }
}

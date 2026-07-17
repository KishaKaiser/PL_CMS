import { Controller, Delete, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { createReadStream } from 'node:fs';
import type { Response } from 'express';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AstrologyChartsService } from './astrology-charts.service';

@Controller('astrology/charts')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class AstrologyChartsController {
  constructor(private readonly chartsService: AstrologyChartsService) {}

  @Get()
  list(@Query('reportType') reportType?: string) {
    return this.chartsService.listCharts(reportType);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.chartsService.getChart(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.chartsService.deleteChart(id);
  }

  @Get(':id/pdf')
  async exportPdf(@Param('id') id: string, @Res() res: Response) {
    const file = await this.chartsService.exportChartPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${file.fileName}"`);
    createReadStream(file.filePath).pipe(res);
  }

  @Post(':id/interpretation')
  generateInterpretation(@Param('id') id: string) {
    return this.chartsService.generateInterpretation(id);
  }
}

import { Body, Controller, Delete, Get, Param, Post, Query, Request, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { createReadStream } from 'node:fs';
import type { Response } from 'express';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AstrologyChartsService } from './astrology-charts.service';
import {
  ElectionalDto,
  FamilyChartDto,
  KarmicChartDto,
  KarmicDebtDto,
  RectificationDto,
  SynastryChartDto,
  TransitDto,
} from './astrology.dto';

type AuthedRequest = { user: { id: string } };

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

  @Post('synastry')
  createSynastry(@Body() dto: SynastryChartDto, @Request() req: AuthedRequest) {
    return this.chartsService.createSynastryChart(req.user.id, dto);
  }

  @Post('karmic')
  createKarmic(@Body() dto: KarmicChartDto, @Request() req: AuthedRequest) {
    return this.chartsService.createKarmicChart(req.user.id, dto);
  }

  @Post('karmic-debt')
  createKarmicDebt(@Body() dto: KarmicDebtDto, @Request() req: AuthedRequest) {
    return this.chartsService.createKarmicDebtChart(req.user.id, dto);
  }

  @Post('family')
  createFamily(@Body() dto: FamilyChartDto, @Request() req: AuthedRequest) {
    return this.chartsService.createFamilyChart(req.user.id, dto);
  }

  @Post('transits')
  createTransits(@Body() dto: TransitDto, @Request() req: AuthedRequest) {
    return this.chartsService.createTransitChart(req.user.id, dto);
  }

  @Post('electional')
  createElectional(@Body() dto: ElectionalDto, @Request() req: AuthedRequest) {
    return this.chartsService.createElectionalChart(req.user.id, dto);
  }

  @Post('rectification')
  createRectification(@Body() dto: RectificationDto, @Request() req: AuthedRequest) {
    return this.chartsService.createRectificationChart(req.user.id, dto);
  }
}

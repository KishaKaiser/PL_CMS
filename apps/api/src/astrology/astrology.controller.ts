import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { PreviewAstrologyChartDto, TestOllamaConnectionDto } from './astrology.dto';
import { AstrologyReportsService } from './astrology-reports.service';

@Controller('astrology')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class AstrologyController {
  constructor(private readonly reportsService: AstrologyReportsService) {}

  @Post('charts/preview')
  previewChart(@Body() dto: PreviewAstrologyChartDto, @Request() req: { user: { id: string } }) {
    return this.reportsService.previewChart(dto, req.user.id);
  }

  @Post('ollama/test')
  testOllama(@Body() dto: TestOllamaConnectionDto) {
    return this.reportsService.testOllamaConnection(dto);
  }
}

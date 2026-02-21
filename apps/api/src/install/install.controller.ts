import { Body, Controller, Get, Post } from '@nestjs/common';
import { InstallService } from './install.service';
import { RunInstallDto } from './install.dto';

@Controller('install')
export class InstallController {
  constructor(private readonly installService: InstallService) {}

  @Get('status')
  status() {
    return this.installService.getStatus();
  }

  @Post('run')
  run(@Body() dto: RunInstallDto) {
    return this.installService.runInstall(dto);
  }
}

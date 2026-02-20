import { Controller, Post, Get, Param, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BillingService } from './billing.service';
import { StartSessionDto } from './billing.dto';

@Controller('billing')
@UseGuards(AuthGuard('jwt'))
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('start')
  startSession(
    @Request() req: { user: { id: string } },
    @Body() dto: StartSessionDto,
  ) {
    return this.billingService.startSession(req.user.id, dto);
  }

  @Post(':id/stop')
  stopSession(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.billingService.stopSession(id, req.user.id);
  }

  @Get('session/active')
  getActiveSession(@Request() req: { user: { id: string } }) {
    return this.billingService.getActiveSession(req.user.id);
  }
}

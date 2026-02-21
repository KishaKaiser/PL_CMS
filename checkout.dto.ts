import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  RawBodyRequest,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BillingService } from './billing.service';
import { StartSessionDto } from './billing.dto';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { Role } from '@pl-cms/shared';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('start')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CLIENT)
  startSession(
    @Request() req: { user: { id: string } },
    @Body() dto: StartSessionDto,
  ) {
    return this.billingService.startSession(req.user.id, dto);
  }

  @Post(':id/stop')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CLIENT)
  stopSession(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.billingService.stopSession(id, req.user.id);
  }

  @Get('session/active')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CLIENT)
  getActiveSession(@Request() req: { user: { id: string } }) {
    return this.billingService.getActiveSession(req.user.id);
  }

  @Post('twilio/status-callback')
  @HttpCode(HttpStatus.OK)
  handleTwilioStatusCallback(
    @Headers() headers: Record<string, string>,
    @Query('sessionId') sessionId: string,
    @Req() req: RawBodyRequest<{ rawBody?: Buffer; protocol?: string; headers?: Record<string, string>; originalUrl?: string }>,
    @Body() body: Record<string, string>,
  ) {
    const rawBody = (req.rawBody ?? Buffer.alloc(0)).toString('utf-8');
    const protocol = req.headers?.['x-forwarded-proto'] ?? req.protocol ?? 'http';
    const host = req.headers?.['x-forwarded-host'] ?? req.headers?.host ?? 'localhost:3001';
    const path = req.originalUrl ?? '/api/billing/twilio/status-callback';
    const callbackUrl = `${protocol}://${host}${path}`;

    return this.billingService.handleTwilioStatusCallback(
      headers,
      rawBody,
      callbackUrl,
      sessionId,
      body,
    );
  }
}

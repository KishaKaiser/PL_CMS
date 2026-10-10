import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  RawBodyRequest,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BillingService, TelnyxWebhookBody } from './billing.service';
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

  /** Telnyx Call Control webhook. Authenticated by its Ed25519 signature, not a login. */
  @Post('telnyx/webhook')
  @HttpCode(HttpStatus.OK)
  handleTelnyxWebhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: RawBodyRequest<object>,
    @Body() body: TelnyxWebhookBody,
  ) {
    const rawBody = (req.rawBody ?? Buffer.alloc(0)).toString('utf-8');
    return this.billingService.handleTelnyxWebhook(headers, rawBody, body);
  }
}

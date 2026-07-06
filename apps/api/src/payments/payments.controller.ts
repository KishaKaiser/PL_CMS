import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  RawBodyRequest,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaypalService } from '../checkout/paypal.service';
import { IsString } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { Role } from '@pl-cms/shared';

export class LegacyWebhookDto {
  @IsString()
  transactionId!: string;

  @IsString()
  orderId!: string;
}

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paypal: PaypalService,
  ) {}

  /** Expose PayPal client ID to the frontend (public, safe to share). */
  @Get('paypal-client-id')
  getPaypalClientId() {
    return this.paypal.getPublicConfig();
  }

  /** Expose a short-lived PayPal client token for Advanced Card Fields. */
  @Get('paypal-client-token')
  getPaypalClientToken() {
    return this.paypal.getClientToken();
  }

  /**
   * PayPal webhook endpoint.
   * PayPal sends raw JSON; we pass headers + raw body for signature verification.
   */
  @Post('paypal/webhook')
  @HttpCode(HttpStatus.OK)
  handlePaypalWebhook(
    @Headers() headers: Record<string, string>,
    @Req() req: RawBodyRequest<{ rawBody?: Buffer }>,
  ) {
    const rawBody = (req.rawBody ?? Buffer.alloc(0)).toString('utf-8');
    return this.paymentsService.handlePaypalWebhook(headers, rawBody);
  }

  /** Legacy internal webhook for non-PayPal confirmations. */
  @Post('webhook')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  handleWebhook(@Body() dto: LegacyWebhookDto) {
    return this.paymentsService.handleWebhook(dto.transactionId, dto.orderId);
  }
}

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
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { IsString } from 'class-validator';

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
    private readonly config: ConfigService,
  ) {}

  /** Expose PayPal client ID to the frontend (public, safe to share). */
  @Get('paypal-client-id')
  getPaypalClientId() {
    return { clientId: this.config.get<string>('PAYPAL_CLIENT_ID') ?? '' };
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
  @HttpCode(HttpStatus.OK)
  handleWebhook(@Body() dto: LegacyWebhookDto) {
    return this.paymentsService.handleWebhook(dto.transactionId, dto.orderId);
  }
}

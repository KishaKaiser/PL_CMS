import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { IsString } from 'class-validator';

export class WebhookDto {
  @IsString()
  transactionId!: string;

  @IsString()
  orderId!: string;
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  handleWebhook(@Body() dto: WebhookDto) {
    return this.paymentsService.handleWebhook(dto.transactionId, dto.orderId);
  }
}

import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CheckoutService } from './checkout.service';
import { CreateCheckoutDto } from './checkout.dto';

@Controller('checkout')
@UseGuards(AuthGuard('jwt'))
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  /** Create a plain DB order (legacy, no PayPal). */
  @Post()
  createOrder(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.checkoutService.createOrder(req.user.id, dto);
  }

  /** Create a PayPal order; returns paypalOrderId + approvalUrl. */
  @Post('paypal-order')
  createPaypalOrder(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.checkoutService.createPaypalOrder(req.user.id, dto);
  }

  /** Capture a PayPal order after buyer approval. */
  @Post('paypal-capture/:paypalOrderId')
  capturePaypalOrder(@Param('paypalOrderId') paypalOrderId: string) {
    return this.checkoutService.capturePaypalOrder(paypalOrderId);
  }
}

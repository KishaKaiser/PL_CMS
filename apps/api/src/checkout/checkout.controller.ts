import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
  Get,
  Patch,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CheckoutService } from './checkout.service';
import { CreateCheckoutDto } from './checkout.dto';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { Role } from '@pl-cms/shared';

@Controller('checkout')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.ADVISOR, Role.EDITOR, Role.CLIENT)
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
  capturePaypalOrder(
    @Request() req: { user: { id: string } },
    @Param('paypalOrderId') paypalOrderId: string,
  ) {
    return this.checkoutService.capturePaypalOrder(paypalOrderId, req.user.id);
  }

  @Get('orders')
  listOrders(@Request() req: { user: { id: string } }) {
    return this.checkoutService.listUserOrders(req.user.id);
  }

  @Get('orders/:orderId')
  getOrder(
    @Request() req: { user: { id: string } },
    @Param('orderId') orderId: string,
  ) {
    return this.checkoutService.getUserOrderById(req.user.id, orderId);
  }

  /** Cancel a pending order and release inventory reservations. */
  @Patch('orders/:orderId/cancel')
  cancelOrder(
    @Request() req: { user: { id: string } },
    @Param('orderId') orderId: string,
  ) {
    return this.checkoutService.cancelOrder(req.user.id, orderId);
  }
}

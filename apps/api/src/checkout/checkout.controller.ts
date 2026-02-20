import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CheckoutService } from './checkout.service';
import { CreateCheckoutDto } from './checkout.dto';

@Controller('checkout')
@UseGuards(AuthGuard('jwt'))
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  createOrder(@Request() req: { user: { id: string } }, @Body() dto: CreateCheckoutDto) {
    return this.checkoutService.createOrder(req.user.id, dto);
  }
}

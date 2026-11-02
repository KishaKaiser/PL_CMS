import { Body, Controller, HttpCode, HttpStatus, Post, Request, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { LookupOrderDto } from './fulfillment.dto';
import { OrderTrackingService } from './order-tracking.service';

/** "Where is my order?" for anyone: by order number, with the email on the order, a signed link from the order's email, or a login. */
@Controller('orders')
export class OrderLookupController {
  constructor(private readonly orderTracking: OrderTrackingService) {}

  @Post('lookup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  lookup(@Request() req: { user?: { id: string; role: string } | null }, @Body() dto: LookupOrderDto) {
    return this.orderTracking.lookup(req.user ?? null, dto);
  }
}

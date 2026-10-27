import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { OrderTrackingService } from './order-tracking.service';

/** Where an order is, for the customer who placed it (and for staff). */
@Controller('orders')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.EDITOR, Role.ADVISOR, Role.CLIENT)
export class OrderTrackingController {
  constructor(private readonly orderTracking: OrderTrackingService) {}

  @Get(':orderId/tracking')
  getTracking(@Request() req: { user: { id: string; role: string } }, @Param('orderId') orderId: string) {
    return this.orderTracking.getTracking(req.user, orderId);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { Role } from '@pl-cms/shared';
import { FulfillmentService } from './fulfillment.service';
import { BuyLabelDto, UpdateShipmentStatusDto } from './fulfillment.dto';

@Controller('fulfillment')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class FulfillmentController {
  constructor(private readonly fulfillmentService: FulfillmentService) {}

  /** List all orders (admin). Supports ?status=CONFIRMED&search=…&page=1&limit=20 */
  @Get('orders')
  listOrders(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.fulfillmentService.listOrders({
      status,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /** Get a single order detail (admin). */
  @Get('orders/:orderId')
  getOrder(@Param('orderId') orderId: string) {
    return this.fulfillmentService.getOrderById(orderId);
  }

  /** Buy a ShipStation shipping label for an order (admin). */
  @Post('orders/:orderId/ship')
  @HttpCode(HttpStatus.CREATED)
  buyLabel(
    @Param('orderId') orderId: string,
    @Body() dto: BuyLabelDto,
  ) {
    return this.fulfillmentService.buyLabel(orderId, dto);
  }

  /** Update a shipment's status (admin). */
  @Patch('shipments/:shipmentId/status')
  updateShipmentStatus(
    @Param('shipmentId') shipmentId: string,
    @Body() dto: UpdateShipmentStatusDto,
  ) {
    return this.fulfillmentService.updateShipmentStatus(shipmentId, dto);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { Role } from '@pl-cms/shared';
import { FulfillmentService } from './fulfillment.service';
import { ShipStationCustomStoreService } from './shipstation-custom-store.service';
import { BuyLabelDto, UpdateOrderStatusDto, UpdateShipmentStatusDto } from './fulfillment.dto';

@Controller('fulfillment')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class FulfillmentController {
  constructor(
    private readonly fulfillmentService: FulfillmentService,
    private readonly customStore: ShipStationCustomStoreService,
  ) {}

  @Get('shipstation-custom-store')
  getShipStationCustomStoreInfo(@Req() request: Request) {
    return this.customStore.getConnectionInfo(getBaseUrl(request));
  }

  @Put('shipstation-custom-store')
  updateShipStationCustomStoreSettings(
    @Body() dto: { username?: string; password?: string },
  ) {
    return this.customStore.upsertConnectionSettings(dto);
  }

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

  @Patch('orders/:orderId/status')
  updateOrderStatus(
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.fulfillmentService.updateOrderStatus(orderId, dto.status);
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

function getBaseUrl(request: Request) {
  const forwardedProto = request.header('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = request.header('x-forwarded-host')?.split(',')[0]?.trim();
  const protocol = forwardedProto || request.protocol || 'https';
  const host = forwardedHost || request.header('host') || '';
  return `${protocol}://${host}`;
}

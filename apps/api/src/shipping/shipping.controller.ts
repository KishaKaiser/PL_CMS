import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { Role } from '@pl-cms/shared';
import { ShippingService } from './shipping.service';
import {
  GetShippingQuoteDto,
  ShippingAddressDto,
  WarehouseAddressDto,
} from './shipping.dto';

@Controller('shipping')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  // ── Admin: warehouse origin ──────────────────

  @Get('warehouse-address')
  @Roles(Role.ADMIN)
  getWarehouseAddress() {
    return this.shippingService.getWarehouseAddress();
  }

  @Put('warehouse-address')
  @Roles(Role.ADMIN)
  upsertWarehouseAddress(@Body() dto: WarehouseAddressDto) {
    return this.shippingService.upsertWarehouseAddress(dto);
  }

  @Get('shipstation-services')
  @Roles(Role.ADMIN)
  getShipStationServices() {
    return this.shippingService.getShipStationServices();
  }

  // ── Client-facing: quote & validate ─────────

  @Post('quote')
  @Roles(Role.CLIENT)
  @HttpCode(HttpStatus.OK)
  getShippingQuote(@Body() dto: GetShippingQuoteDto) {
    return this.shippingService.getShippingQuote(dto);
  }

  @Post('validate-address')
  @Roles(Role.CLIENT)
  @HttpCode(HttpStatus.OK)
  validateAddress(@Body() dto: ShippingAddressDto) {
    return this.shippingService.validateAddress(dto);
  }
}

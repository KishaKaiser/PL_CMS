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
  TestShippingQuoteDto,
  WarehouseAddressDto,
} from './shipping.dto';

@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  // ── Admin: warehouse origin ──────────────────

  @Get('warehouse-address')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  getWarehouseAddress() {
    return this.shippingService.getWarehouseAddress();
  }

  @Put('warehouse-address')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  upsertWarehouseAddress(@Body() dto: WarehouseAddressDto) {
    return this.shippingService.upsertWarehouseAddress(dto);
  }

  @Get('shipstation-services')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  getShipStationServices() {
    return this.shippingService.getShipStationServices();
  }

  @Get('diagnostics')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  getDiagnostics() {
    return this.shippingService.getDiagnostics();
  }

  @Post('diagnostics/test-quote')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  testQuote(@Body() dto: TestShippingQuoteDto) {
    return this.shippingService.testShippingQuote(dto);
  }

  // ── Client-facing: quote & validate ─────────

  @Post('quote')
  @HttpCode(HttpStatus.OK)
  getShippingQuote(@Body() dto: GetShippingQuoteDto) {
    return this.shippingService.getShippingQuote(dto);
  }

  @Post('validate-address')
  @HttpCode(HttpStatus.OK)
  validateAddress(@Body() dto: ShippingAddressDto) {
    return this.shippingService.validateAddress(dto);
  }
}

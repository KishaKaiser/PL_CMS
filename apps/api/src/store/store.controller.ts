import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../auth/roles.guard';
import {
  CartRecoverySettingsDto,
  EcommerceSettingsDto,
  FreeShippingSettingsDto,
  StoreCouponDto,
  StoreEmailTemplateDto,
  TrackCartDto,
  ValidateCouponDto,
} from './store.dto';
import { StoreService } from './store.service';

@Controller('store')
export class StoreController {
  constructor(private readonly store: StoreService) {}

  @Post('coupons/validate')
  validateCoupon(@Body() dto: ValidateCouponDto) {
    return this.store.validateCoupon(dto.code, dto.subtotal);
  }

  @Post('cart-recovery/track')
  trackCart(@Body() dto: TrackCartDto) {
    return this.store.trackCart(dto);
  }

  @Get('free-shipping')
  getPublicFreeShipping() {
    return this.store.getFreeShippingSettings();
  }

  @Get('ecommerce')
  getPublicEcommerceSettings() {
    return this.store.getEcommerceSettings();
  }

  @Get('admin/coupons')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  listCoupons() {
    return this.store.listCoupons();
  }

  @Get('admin/ecommerce')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  getEcommerceSettings() {
    return this.store.getEcommerceSettings();
  }

  @Put('admin/ecommerce')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  saveEcommerceSettings(@Body() dto: EcommerceSettingsDto) {
    return this.store.saveEcommerceSettings(dto);
  }

  @Post('admin/coupons')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  saveCoupon(@Body() dto: StoreCouponDto) {
    return this.store.saveCoupon(dto);
  }

  @Delete('admin/coupons/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  deleteCoupon(@Param('id') id: string) {
    return this.store.deleteCoupon(id);
  }

  @Get('admin/free-shipping')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  getFreeShipping() {
    return this.store.getFreeShippingSettings();
  }

  @Put('admin/free-shipping')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  saveFreeShipping(@Body() dto: FreeShippingSettingsDto) {
    return this.store.saveFreeShippingSettings(dto);
  }

  @Get('admin/cart-recovery')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  getCartRecovery() {
    return this.store.getCartRecoverySettings();
  }

  @Put('admin/cart-recovery')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  saveCartRecovery(@Body() dto: CartRecoverySettingsDto) {
    return this.store.saveCartRecoverySettings(dto);
  }

  @Get('admin/cart-recovery/carts')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  listRecoveredCarts() {
    return this.store.listRecoveredCarts();
  }

  @Get('admin/emails')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  getEmails() {
    return this.store.getEmailTemplates();
  }

  @Put('admin/emails')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  saveEmails(@Body() dto: StoreEmailTemplateDto[]) {
    return this.store.saveEmailTemplates(dto);
  }
}

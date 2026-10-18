import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { PaypalService } from './paypal.service';

@Controller('admin/paypal')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class PaypalAdminController {
  constructor(private readonly paypal: PaypalService) {}

  /**
   * Finds out whether this PayPal app is allowed to save customers' PayPal wallets. Uses the saved billing settings,
   * saves nothing and charges nothing.
   */
  @Post('check-wallet-access')
  checkWalletAccess(@Body() body: { returnOrigin?: string }) {
    let origin: string;
    try {
      const url = new URL(body?.returnOrigin ?? '');
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('not a web address');
      origin = url.origin;
    } catch {
      throw new BadRequestException('A web address for this site is needed to run the check.');
    }
    return this.paypal.checkWalletAccess(origin);
  }
}

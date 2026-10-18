import { BadRequestException, Body, Controller, Delete, Get, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { PaypalWalletService } from './paypal-wallet.service';

type AuthedRequest = { user: { id: string } };

/** A client's saved PayPal wallet, used to add money during a call. */
@Controller('wallet/paypal')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.CLIENT)
export class PaypalWalletController {
  constructor(private readonly wallets: PaypalWalletService) {}

  @Get()
  status(@Request() req: AuthedRequest) {
    return this.wallets.status(req.user.id);
  }

  /** Returns the PayPal page the client approves their wallet on; PayPal sends them back to /client/paypal-wallet. */
  @Post('connect')
  connect(@Request() req: AuthedRequest, @Body() body: { returnOrigin?: string }) {
    let origin: string;
    try {
      const url = new URL(body?.returnOrigin ?? '');
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('not a web address');
      origin = url.origin;
    } catch {
      throw new BadRequestException('A web address for this site is needed to connect PayPal.');
    }
    return this.wallets.startConnect(req.user.id, `${origin}/client/paypal-wallet`);
  }

  @Post('complete')
  complete(@Request() req: AuthedRequest, @Body() body: { setupTokenId?: string }) {
    const id = typeof body?.setupTokenId === 'string' && body.setupTokenId.length < 100 ? body.setupTokenId : undefined;
    return this.wallets.completeConnect(req.user.id, id);
  }

  @Delete()
  disconnect(@Request() req: AuthedRequest) {
    return this.wallets.disconnect(req.user.id);
  }
}

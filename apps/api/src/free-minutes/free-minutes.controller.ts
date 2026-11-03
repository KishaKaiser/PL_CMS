import { BadRequestException, Body, Controller, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@pl-cms/shared';
import { clientIp } from '../common/client-ip';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AdminGiftDto, AdvisorGiftDto, ClaimPromoDto, PromoPaymentDto, WelcomePromoDto } from './free-minutes.dto';
import { FreeMinutesService } from './free-minutes.service';

type AuthedRequest = { user: { id: string; role: string }; headers: Record<string, string | string[] | undefined>; ip?: string };

/** Free minutes as the client and the advisor see them. */
@Controller('free-minutes')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class FreeMinutesController {
  constructor(private readonly freeMinutes: FreeMinutesService) {}

  /** The signed-in client's free minutes. */
  @Get('mine')
  @Roles(Role.CLIENT)
  mine(@Request() req: AuthedRequest) {
    return this.freeMinutes.mine(req.user.id);
  }

  /** The new customer promotion as this client sees it: its price and minutes, and whether they can claim it. */
  @Get('promo/offer')
  @Roles(Role.CLIENT)
  promoOffer(@Request() req: AuthedRequest) {
    return this.freeMinutes.offerFor(req.user.id, clientIp(req));
  }

  /** Returns the PayPal page the client pays the promotion price on; PayPal sends them back to /client/promo. */
  @Post('promo/start')
  @Roles(Role.CLIENT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  startPromo(@Request() req: AuthedRequest, @Body() dto: ClaimPromoDto) {
    let origin: string;
    try {
      const url = new URL(dto.returnOrigin);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('not a web address');
      origin = url.origin;
    } catch {
      throw new BadRequestException('A web address for this site is needed to start the payment.');
    }
    return this.freeMinutes.startClaim(req.user.id, clientIp(req), origin);
  }

  /** The client is back from PayPal: take the payment and grant the minutes. */
  @Post('promo/complete')
  @Roles(Role.CLIENT)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  completePromo(@Request() req: AuthedRequest, @Body() dto: PromoPaymentDto) {
    return this.freeMinutes.completeClaim(req.user.id, dto.paypalOrderId);
  }

  /** The client left PayPal without paying. */
  @Post('promo/cancel')
  @Roles(Role.CLIENT)
  cancelPromo(@Request() req: AuthedRequest, @Body() dto: PromoPaymentDto) {
    return this.freeMinutes.cancelClaim(req.user.id, dto.paypalOrderId);
  }

  /** An advisor sends 1, 3 or 5 free minutes to a client who has contacted them. */
  @Post('gift')
  @Roles(Role.ADVISOR)
  gift(@Request() req: AuthedRequest, @Body() dto: AdvisorGiftDto) {
    return this.freeMinutes.giveAsAdvisor(req.user.id, dto);
  }

  @Get('sent')
  @Roles(Role.ADVISOR)
  sent(@Request() req: AuthedRequest) {
    return this.freeMinutes.sentByAdvisor(req.user.id);
  }
}

/** Admin: send free minutes and run the welcome promotion. */
@Controller('admin/free-minutes')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class AdminFreeMinutesController {
  constructor(private readonly freeMinutes: FreeMinutesService) {}

  @Get()
  overview() {
    return this.freeMinutes.overview();
  }

  @Post('send')
  send(@Request() req: AuthedRequest, @Body() dto: AdminGiftDto) {
    return this.freeMinutes.giveAsAdmin(req.user.id, dto);
  }

  @Get('promo')
  promo() {
    return this.freeMinutes.getPromo();
  }

  @Put('promo')
  setPromo(@Body() dto: WelcomePromoDto) {
    return this.freeMinutes.setPromo(dto);
  }

  /** Who claimed the promotion, and from which internet connection. */
  @Get('promo/claims')
  claims() {
    return this.freeMinutes.claims();
  }

  /** Lets that internet connection claim the promotion again. */
  @Post('promo/claims/:id/release')
  releaseClaim(@Param('id') id: string) {
    return this.freeMinutes.releaseAddress(id);
  }
}

import { Body, Controller, Delete, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { SavePayoutDetailsDto } from './payouts.dto';
import { PayoutsService } from './payouts.service';

type AuthedRequest = { user: { id: string } };

/** An advisor's own earnings, payouts and payout details. */
@Controller('payouts')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADVISOR)
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  /** Earnings summary, the per-call breakdown (paged) and payments received. `tz` cuts "this month" in the advisor's own zone. */
  @Get('me')
  overview(@Request() req: AuthedRequest, @Query('tz') tz?: string, @Query('page') page?: string) {
    return this.payouts.myOverview(req.user.id, tz, page ? Number(page) : undefined);
  }

  @Get('me/methods')
  methods(@Request() req: AuthedRequest) {
    return this.payouts.listMethods(req.user.id);
  }

  @Post('me/methods')
  saveMethod(@Request() req: AuthedRequest, @Body() dto: SavePayoutDetailsDto) {
    return this.payouts.saveMethod(req.user.id, dto);
  }

  @Delete('me/methods/:id')
  removeMethod(@Request() req: AuthedRequest, @Param('id') id: string) {
    return this.payouts.removeMethod(req.user.id, id);
  }
}

import { Body, Controller, Get, Put, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { SetPayoutMethodDto } from './payouts.dto';
import { PayoutsService } from './payouts.service';

type AuthedRequest = { user: { id: string } };

/** An advisor's own earnings, payments received and choice of how to be paid. */
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

  /** How the advisor is paid (PayPal or Direct Deposit) and whether Direct Deposit is available to them. */
  @Get('me/details')
  details(@Request() req: AuthedRequest) {
    return this.payouts.myDetails(req.user.id);
  }

  @Put('me/details')
  setMethod(@Request() req: AuthedRequest, @Body() dto: SetPayoutMethodDto) {
    return this.payouts.setMyMethod(req.user.id, dto);
  }
}

import { Body, Controller, Get, Post, Put, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AdminGiftDto, AdvisorGiftDto, WelcomePromoDto } from './free-minutes.dto';
import { FreeMinutesService } from './free-minutes.service';

type AuthedRequest = { user: { id: string; role: string } };

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
}

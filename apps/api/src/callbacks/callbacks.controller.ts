import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CallbacksService } from './callbacks.service';
import { JoinQueueDto } from './callbacks.dto';

type AuthedRequest = { user: { id: string; role: string } };

@Controller('callbacks')
export class CallbacksController {
  constructor(private readonly callbacks: CallbacksService) {}

  @Post('join')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CLIENT)
  join(@Request() req: AuthedRequest, @Body() dto: JoinQueueDto) {
    return this.callbacks.join(req.user.id, dto);
  }

  @Get('mine')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CLIENT, Role.ADVISOR)
  mine(@Request() req: AuthedRequest) {
    return this.callbacks.mine(req.user);
  }

  @Post(':id/leave')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CLIENT)
  leave(@Request() req: AuthedRequest, @Param('id') id: string) {
    return this.callbacks.leave(req.user.id, id);
  }
}

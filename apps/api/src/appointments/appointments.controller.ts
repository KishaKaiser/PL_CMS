import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AppointmentsService } from './appointments.service';
import { RequestAppointmentDto } from './appointments.dto';

type AuthedRequest = { user: { id: string; role: string } };

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CLIENT)
  request(@Request() req: AuthedRequest, @Body() dto: RequestAppointmentDto) {
    return this.appointments.request(req.user.id, dto);
  }

  @Get('mine')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CLIENT, Role.ADVISOR)
  listMine(@Request() req: AuthedRequest) {
    return this.appointments.listMine(req.user);
  }

  @Post(':id/accept')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADVISOR)
  accept(@Request() req: AuthedRequest, @Param('id') id: string) {
    return this.appointments.accept(req.user.id, id);
  }

  @Post(':id/decline')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADVISOR)
  decline(@Request() req: AuthedRequest, @Param('id') id: string) {
    return this.appointments.decline(req.user.id, id);
  }

  @Post(':id/cancel')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CLIENT, Role.ADVISOR)
  cancel(@Request() req: AuthedRequest, @Param('id') id: string) {
    return this.appointments.cancel(req.user, id);
  }
}

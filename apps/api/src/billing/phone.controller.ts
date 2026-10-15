import { Body, Controller, Get, Put, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { SetPhoneNumberDto } from './billing.dto';
import { PhoneService } from './phone.service';

@Controller('phone')
export class PhoneController {
  constructor(private readonly phoneService: PhoneService) {}

  /** Public: the advisor cards, online advisors first, each of which can be called now or scheduled. */
  @Get('advisors')
  listAdvisors() {
    return this.phoneService.listAdvisors();
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CLIENT)
  getMyPhoneProfile(@Request() req: { user: { id: string } }) {
    return this.phoneService.getMyPhoneProfile(req.user.id);
  }

  @Put('me')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CLIENT)
  setMyPhoneNumber(@Request() req: { user: { id: string } }, @Body() dto: SetPhoneNumberDto) {
    return this.phoneService.setMyPhoneNumber(req.user.id, dto.phoneNumber);
  }
}

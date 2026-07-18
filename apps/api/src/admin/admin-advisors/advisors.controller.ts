import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles } from '../../auth/roles.guard';
import { Role } from '@pl-cms/shared';
import { AdminAdvisorsService } from './advisors.service';
import { UpdateAdvisorExtensionDto } from './advisors.dto';

@Controller('advisors')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class AdminAdvisorsController {
  constructor(private readonly advisorsService: AdminAdvisorsService) {}

  @Get() findAll() { return this.advisorsService.findAll(); }

  @Patch(':id')
  updateExtension(@Param('id') id: string, @Body() dto: UpdateAdvisorExtensionDto) {
    return this.advisorsService.updateExtension(id, dto);
  }
}

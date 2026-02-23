import { Controller, Get, Patch, Body, Param, UseGuards, Post } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles } from '../../auth/roles.guard';
import { Role } from '@pl-cms/shared';
import { AdminUsersService } from './users.service';
import { UpdateUserRoleDto, ResetPasswordDto } from './users.dto';

@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class AdminUsersController {
  constructor(private readonly usersService: AdminUsersService) {}

  @Get() findAll() { return this.usersService.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.usersService.findOne(id); }
  @Patch(':id/role') updateRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto) { return this.usersService.updateRole(id, dto); }
  @Post(':id/reset-password') resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) { return this.usersService.resetPassword(id, dto); }
}

import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles } from '../../auth/roles.guard';
import { Role } from '@pl-cms/shared';
import { AdminUsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UpdateUserRoleDto, ResetPasswordDto } from './users.dto';

@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class AdminUsersController {
  constructor(private readonly usersService: AdminUsersService) {}

  @Get() findAll() { return this.usersService.findAll(); }
  @Post() create(@Body() dto: CreateUserDto) { return this.usersService.create(dto); }
  @Get(':id') findOne(@Param('id') id: string) { return this.usersService.findOne(id); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateUserDto) { return this.usersService.update(id, dto); }
  @Patch(':id/role') updateRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto) { return this.usersService.updateRole(id, dto); }
  @Post(':id/reset-password') resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) { return this.usersService.resetPassword(id, dto); }
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) { return this.usersService.remove(id); }
}

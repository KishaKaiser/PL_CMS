import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@pl-cms/shared';

export class UpdateUserRoleDto {
  @IsEnum(Role) role: Role;
}

export class ResetPasswordDto {
  @IsString() @MinLength(8) newPassword: string;
}

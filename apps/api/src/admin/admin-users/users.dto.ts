import { IsEmail, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { Role } from '@pl-cms/shared';

export class CreateUserDto {
  @IsEmail() email!: string;
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]{3,32}$/)
  username?: string;
  @IsString() @MinLength(1) name!: string;
  @IsEnum(Role) role!: Role;
  @IsString() @MinLength(8) password!: string;
}

export class UpdateUserRoleDto {
  @IsEnum(Role) role!: Role;
}

export class ResetPasswordDto {
  @IsString() @MinLength(8) newPassword!: string;
}

import { IsBoolean, IsObject, IsOptional, IsString, Matches } from 'class-validator';

export class CreateModuleDto {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-_.]*$/i, {
    message: 'name must use letters, numbers, dashes, underscores, or periods',
  })
  name!: string;

  @IsString()
  version!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class UpdateModuleDto {
  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

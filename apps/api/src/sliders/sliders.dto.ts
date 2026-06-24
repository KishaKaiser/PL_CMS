import { IsArray, IsEnum, IsObject, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export enum CmsSliderStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}

export class CreateSliderDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(CmsSliderStatus)
  status?: CmsSliderStatus;

  @IsOptional()
  @IsArray()
  slides?: Record<string, unknown>[];

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

export class UpdateSliderDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsEnum(CmsSliderStatus)
  status?: CmsSliderStatus;

  @IsOptional()
  @IsArray()
  slides?: Record<string, unknown>[];

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

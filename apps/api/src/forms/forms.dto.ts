import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { Role } from '@pl-cms/shared';

export enum CmsFormType {
  CONTACT = 'CONTACT',
  REGISTRATION = 'REGISTRATION',
}

export enum CmsFormStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}

export class CreateCmsFormDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(CmsFormType)
  type!: CmsFormType;

  @IsOptional()
  @IsEnum(CmsFormStatus)
  status?: CmsFormStatus;

  @IsOptional()
  @IsArray()
  fields?: Record<string, unknown>[];

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  successMessage?: string;
}

export class UpdateCmsFormDto {
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
  @IsEnum(CmsFormType)
  type?: CmsFormType;

  @IsOptional()
  @IsEnum(CmsFormStatus)
  status?: CmsFormStatus;

  @IsOptional()
  @IsArray()
  fields?: Record<string, unknown>[];

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  successMessage?: string;
}

export class SubmitCmsFormDto {
  @IsObject()
  data!: Record<string, unknown>;
}

export class RegistrationSettingsDto {
  @IsOptional()
  @IsEnum(Role)
  defaultRole?: Role;

  @IsOptional()
  @IsBoolean()
  createUser?: boolean;
}

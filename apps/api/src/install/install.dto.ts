import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import {
  normalizeEmailInput,
  normalizeOptionalStringInput,
} from '../common/input-normalization.util';

export class RunInstallDto {
  @Transform(({ value }: { value: unknown }) => normalizeEmailInput(value))
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @Transform(({ value }: { value: unknown }) => normalizeOptionalStringInput(value))
  @IsOptional()
  @IsString()
  name?: string;
}

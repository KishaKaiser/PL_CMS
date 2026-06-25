import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';
import { normalizeEmailInput } from '../common/input-normalization.util';

export class LoginDto {
  @Transform(({ value }: { value: unknown }) => normalizeEmailInput(value))
  @IsString()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}

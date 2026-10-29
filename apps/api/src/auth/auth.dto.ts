import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
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

/** "Forgot password": the email address (or username) of the account. */
export class ForgotPasswordDto {
  @Transform(({ value }: { value: unknown }) => normalizeEmailInput(value))
  @IsString()
  @MaxLength(254)
  identifier!: string;
}

/** Choosing a new password with the link from the email. */
export class ResetPasswordWithTokenDto {
  @IsString()
  @MaxLength(200)
  token!: string;

  /** At least 8 characters, as when signing in. At most 72, which is as much as the password scrambling uses. */
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}

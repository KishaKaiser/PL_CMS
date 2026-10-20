import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SetPayoutMethodDto {
  @IsIn(['PAYPAL', 'DIRECT_DEPOSIT'])
  method!: 'PAYPAL' | 'DIRECT_DEPOSIT';

  /** The PayPal account to pay. Kept when switching to Direct Deposit and back. */
  @IsOptional()
  @IsString()
  @MaxLength(254)
  paypalEmail?: string;
}

export class BankOnFileDto {
  @IsBoolean()
  onFile!: boolean;
}

export class SetDefaultShareDto {
  @IsInt()
  @Min(0)
  @Max(100)
  sharePercent!: number;
}

export class SetPaypalFeeDto {
  /** Percent of each PayPal payment kept as the fee, with at most two decimals. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(50)
  paypalFeePercent!: number;
}

export class SetAdvisorShareDto {
  /** null = use the platform default. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  sharePercent?: number | null;
}

export class RecordPayoutDto {
  /** In cents, so there is no rounding. */
  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  /** When it was paid; defaults to now. */
  @IsOptional()
  @IsString()
  paidAt?: string;
}

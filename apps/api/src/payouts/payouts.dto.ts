import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SavePayoutDetailsDto {
  @IsIn(['PAYPAL', 'BANK', 'OTHER'])
  type!: 'PAYPAL' | 'BANK' | 'OTHER';

  /** The name on the account. */
  @IsString()
  @MaxLength(120)
  accountName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  routingNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  accountNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class SetDefaultShareDto {
  @IsInt()
  @Min(0)
  @Max(100)
  sharePercent!: number;
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

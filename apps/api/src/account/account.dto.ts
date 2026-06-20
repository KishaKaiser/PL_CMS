import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}

export class SaveAddressDto {
  @IsString()
  @MaxLength(80)
  label!: string;

  @IsString()
  @MaxLength(120)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsString()
  @MaxLength(160)
  line1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  line2?: string;

  @IsString()
  @MaxLength(80)
  city!: string;

  @IsString()
  @MaxLength(40)
  state!: string;

  @IsString()
  @MaxLength(20)
  postalCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class SavePaymentMethodDto {
  @IsString()
  @MaxLength(80)
  label!: string;

  @IsString()
  @MaxLength(80)
  provider!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  last4?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAdvisorProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ratePerMinute?: number;

  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;
}

export class SavePayoutMethodDto {
  @IsString()
  @MaxLength(80)
  label!: string;

  @IsString()
  @MaxLength(80)
  methodType!: string;

  @IsString()
  @MaxLength(120)
  accountName!: string;

  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

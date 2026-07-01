import { IsArray, IsBoolean, IsEmail, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class StoreCouponDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  code!: string;

  @IsIn(['percent', 'fixed'])
  type!: 'percent' | 'fixed';

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumSubtotal?: number;

  @IsOptional()
  @IsString()
  startsAt?: string;

  @IsOptional()
  @IsString()
  endsAt?: string;

  @IsBoolean()
  enabled!: boolean;
}

export class ValidateCouponDto {
  @IsString()
  code!: string;

  @IsNumber()
  @Min(0)
  subtotal!: number;
}

export class FreeShippingSettingsDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumSubtotal?: number;

  @IsOptional()
  @IsString()
  label?: string;
}

export class CartRecoverySettingsDto {
  @IsBoolean()
  enabled!: boolean;

  @IsNumber()
  @Min(1)
  delayMinutes!: number;

  @IsNumber()
  @Min(1)
  expiresDays!: number;
}

export class TrackCartDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsNumber()
  @Min(0)
  subtotal!: number;

  @IsArray()
  items!: unknown[];
}

export class StoreEmailTemplateDto {
  @IsString()
  key!: string;

  @IsString()
  subject!: string;

  @IsString()
  body!: string;

  @IsBoolean()
  enabled!: boolean;
}

export class EcommerceSettingsDto {
  @IsString()
  storeName!: string;

  @IsString()
  currency!: string;

  @IsString()
  orderPrefix!: string;

  @IsBoolean()
  taxEnabled!: boolean;

  @IsNumber()
  @Min(0)
  taxRatePercent!: number;

  @IsBoolean()
  pricesIncludeTax!: boolean;

  @IsBoolean()
  guestCheckoutEnabled!: boolean;

  @IsBoolean()
  requirePhone!: boolean;

  @IsBoolean()
  inventoryTrackingEnabled!: boolean;

  @IsNumber()
  @Min(0)
  lowStockThreshold!: number;

  @IsNumber()
  @Min(0)
  holdStockMinutes!: number;

  @IsString()
  termsPageUrl!: string;
}

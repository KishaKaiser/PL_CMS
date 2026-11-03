import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AdvisorGiftDto {
  @IsString()
  clientUserId!: string;

  /** 1, 3 or 5: checked in the service. */
  @IsInt()
  minutes!: number;
}

export class AdminGiftDto {
  @IsIn(['CLIENT', 'ALL_CLIENTS'])
  audience!: 'CLIENT' | 'ALL_CLIENTS';

  @IsOptional()
  @IsString()
  clientUserId?: string;

  @IsInt()
  @Min(1)
  @Max(600)
  minutes!: number;

  /** Days the minutes last; leave out for no expiry. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class WelcomePromoDto {
  @IsBoolean()
  enabled!: boolean;

  @IsInt()
  @Min(1)
  @Max(600)
  minutes!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number;

  /** What the client pays, in cents; 0 makes the promotion free. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  priceCents?: number;
}

export class ClaimPromoDto {
  /** The web address of this site as the client sees it; PayPal sends them back to it after paying. */
  @IsString()
  @MaxLength(200)
  returnOrigin!: string;
}

export class PromoPaymentDto {
  /** The PayPal order the client was sent to (PayPal adds it to the address as "token"). */
  @IsString()
  @MaxLength(100)
  paypalOrderId!: string;
}

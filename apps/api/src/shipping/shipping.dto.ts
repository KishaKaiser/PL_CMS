import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsArray,
  ValidateNested,
  IsEmail,
  Length,
  Matches,
  IsIn,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { DELIVERABLE_EMAIL_SOURCE, INVALID_EMAIL_MESSAGE } from '@pl-cms/shared';

/** An address a customer can really receive mail at (see isDeliverableEmail). */
const DELIVERABLE_EMAIL = new RegExp(DELIVERABLE_EMAIL_SOURCE, 'u');

export class ShippingAddressDto {
  @IsString()
  fullName!: string;

  @IsString()
  phone!: string;

  @IsString()
  line1!: string;

  @IsOptional()
  @IsString()
  line2?: string;

  @IsOptional()
  @IsIn(['commercial', 'residential'])
  addressType?: 'commercial' | 'residential';

  @IsString()
  city!: string;

  @IsString()
  @Length(2, 2)
  state!: string;

  @IsString()
  @Matches(/^\d{5}(-\d{4})?$/, { message: 'postalCode must be a valid US ZIP code' })
  postalCode!: string;

  /** US-only at this time. */
  @IsIn(['US'])
  country!: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @Matches(DELIVERABLE_EMAIL, { message: INVALID_EMAIL_MESSAGE })
  email!: string;
}

export class QuoteItemDto {
  @IsString()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  /** Weight in ounces (optional – defaults to DEFAULT_ITEM_WEIGHT_OZ per item). */
  @IsOptional()
  @IsInt()
  @Min(1)
  weightOz?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  lengthIn?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  widthIn?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  heightIn?: number;

  /** A custom candle: its type, so its weight can be looked up. */
  @IsOptional()
  @IsString()
  customTypeId?: string;
}

export class GetShippingQuoteDto {
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  address!: ShippingAddressDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items!: QuoteItemDto[];
}

export class TestShippingQuoteDto {
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  address!: ShippingAddressDto;

  @IsOptional()
  @IsInt()
  @Min(1)
  weightOz?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  lengthIn?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  widthIn?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  heightIn?: number;
}

export class WarehouseAddressDto {
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsString()
  fullName!: string;

  @IsString()
  phone!: string;

  @IsString()
  line1!: string;

  @IsOptional()
  @IsString()
  line2?: string;

  @IsString()
  city!: string;

  @IsString()
  @Length(2, 2)
  state!: string;

  @IsString()
  @Matches(/^\d{5}(-\d{4})?$/, { message: 'postalCode must be a valid US ZIP code' })
  postalCode!: string;

  /** US-only at this time. */
  @IsIn(['US'])
  country!: string;
}

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
import { Type } from 'class-transformer';

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

  @IsEmail()
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

export class WarehouseAddressDto {
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

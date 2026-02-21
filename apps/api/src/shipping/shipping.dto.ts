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

  @IsString()
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

  /** Weight in ounces (optional – defaults to 16 oz per item). */
  @IsOptional()
  @IsInt()
  @Min(1)
  weightOz?: number;
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

  @IsString()
  country!: string;
}

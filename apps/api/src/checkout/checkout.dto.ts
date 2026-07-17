import {
  IsArray,
  ValidateNested,
  IsString,
  IsInt,
  IsBoolean,
  Min,
  IsOptional,
  IsNumber,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ShippingAddressDto } from '../shipping/shipping.dto';

export class CheckoutItemDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class LifeEventFormDto {
  @IsString()
  description!: string;

  @IsString()
  date!: string;
}

export class AstrologyReportFormDto {
  @IsString()
  productId!: string;

  @IsString()
  fullName!: string;

  @IsString()
  birthDate!: string;

  /** Required unless timeUnknown is set, in which case lifeEvents is used instead. */
  @IsOptional()
  @IsString()
  birthTime?: string;

  @IsOptional()
  @IsBoolean()
  timeUnknown?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LifeEventFormDto)
  lifeEvents?: LifeEventFormDto[];

  @IsString()
  birthCity!: string;

  @IsString()
  birthState!: string;

  @IsString()
  birthCountry!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  birthLatitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  birthLongitude?: number;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateCheckoutDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];

  /** Shipping address chosen by the customer (required for physical orders). */
  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress?: ShippingAddressDto;

  /** ShipStation carrier code for the selected rate. */
  @IsOptional()
  @IsString()
  shippingCarrier?: string;

  /** ShipStation service code for the selected rate. */
  @IsOptional()
  @IsString()
  shippingService?: string;

  /** Shipping amount returned by ShipStation (shipmentCost + otherCost). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingAmount?: number;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AstrologyReportFormDto)
  astrologyForms?: AstrologyReportFormDto[];
}

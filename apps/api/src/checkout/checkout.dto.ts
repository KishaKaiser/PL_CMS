import {
  IsArray,
  ValidateNested,
  IsString,
  IsInt,
  Min,
  IsOptional,
  IsNumber,
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

export class AstrologyReportFormDto {
  @IsString()
  productId!: string;

  @IsString()
  fullName!: string;

  @IsString()
  birthDate!: string;

  @IsString()
  birthTime!: string;

  @IsString()
  birthCity!: string;

  @IsString()
  birthState!: string;

  @IsString()
  birthCountry!: string;

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

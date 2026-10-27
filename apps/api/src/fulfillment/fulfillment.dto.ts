import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';
import { SETTABLE_STAGES, type SettableStage } from './order-progress';

export class BuyLabelDto {
  /** ShipStation carrier code (e.g. "stamps_com", "fedex"). */
  @IsString()
  carrierCode!: string;

  /** ShipStation service code (e.g. "usps_priority_mail"). */
  @IsString()
  serviceCode!: string;
}

export class UpdateShipmentStatusDto {
  @IsIn(['SHIPPED', 'DELIVERED', 'CANCELLED'])
  status!: 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

  /** Optional tracking number override. */
  @IsOptional()
  @IsString()
  trackingNumber?: string;
}

/** Moves an order to a step: being made, being packaged, ready to ship, shipped (with provider and tracking number) or delivered. */
export class UpdateOrderProgressDto {
  @IsIn(SETTABLE_STAGES)
  stage!: SettableStage;

  /** The shipping provider, needed for "shipped". "other" uses carrierName. */
  @IsOptional()
  @IsIn(['usps', 'ups', 'other'])
  carrier?: 'usps' | 'ups' | 'other';

  @IsOptional()
  @IsString()
  @MaxLength(60)
  carrierName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  trackingNumber?: string;
}

export class UpdateOrderStatusDto {
  @IsIn(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'CANCELLED', 'COMPLETED', 'REFUNDED'])
  status!: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'CANCELLED' | 'COMPLETED' | 'REFUNDED';
}

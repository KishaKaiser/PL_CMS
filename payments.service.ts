import { IsString, IsOptional, IsIn } from 'class-validator';

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

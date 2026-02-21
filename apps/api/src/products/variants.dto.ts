import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUrl,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVariantDto {
  @IsString()
  color!: string;

  @IsString()
  sku!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  priceOverride?: number;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateVariantDto {
  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  priceOverride?: number;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateInventoryDto {
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  onHand!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  reserved?: number;
}

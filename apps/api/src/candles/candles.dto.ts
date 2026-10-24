import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const MONEY = { maxDecimalPlaces: 2 } as const;

/** What a customer chose on the custom candle page. The server checks every part of it and works out the price itself. */
export class CandleSelectionDto {
  @IsString()
  typeId!: string;

  @IsString()
  colorId!: string;

  /** The lower color of a two-color candle; the first color is the upper one. */
  @IsOptional()
  @IsString()
  color2Id?: string;

  @IsOptional()
  @IsString()
  sizeId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  herbIds?: string[];
}

export class CandleSizeInputDto {
  /** Present when editing a height that already exists, so carts that mention it keep working. */
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(MONEY)
  @Min(0)
  @Max(100000)
  extraPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(20)
  @Max(100)
  heightPercent?: number;
}

export class SaveCandleTypeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @Type(() => Number)
  @IsNumber(MONEY)
  @Min(0)
  @Max(100000)
  basePrice!: number;

  @IsOptional()
  @IsString()
  photoMediaId?: string | null;

  @IsOptional()
  @IsString()
  waxMaskMediaId?: string | null;

  @IsOptional()
  @IsBoolean()
  allowTwoColors?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(MONEY)
  @Min(0)
  @Max(100000)
  twoColorExtra?: number;

  @IsOptional()
  @IsBoolean()
  allowHerbs?: boolean;

  /** How far down from the top of the candle the wax starts, in percent. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  waxTopPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5000)
  weightOz?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  /** The full list of heights. Heights left out of the list are removed. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CandleSizeInputDto)
  sizes?: CandleSizeInputDto[];
}

export class SaveCandleColorDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @Matches(HEX_COLOR, { message: 'hex must look like #3b82f6' })
  hex!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class SaveCandleHerbDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(MONEY)
  @Min(0)
  @Max(100000)
  price?: number;

  @IsOptional()
  @Matches(HEX_COLOR, { message: 'hex must look like #4d7c3a' })
  hex?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

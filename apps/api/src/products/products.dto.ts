import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  @IsIn(['PHYSICAL', 'DIGITAL', 'MINUTE_PACK'])
  type?: 'PHYSICAL' | 'DIGITAL' | 'MINUTE_PACK';

  @IsOptional()
  @IsString()
  @IsIn(['NONE', 'ASTROLOGY_REPORT'])
  digitalDelivery?: 'NONE' | 'ASTROLOGY_REPORT';

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  price!: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  regularPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  salePrice?: number | null;

  @IsOptional()
  @IsDateString()
  saleStartsAt?: string | null;

  @IsOptional()
  @IsDateString()
  saleEndsAt?: string | null;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minutesPack!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Leave the product out of the shop and its lists and filters; it can still be bought with its direct link. */
  @IsOptional()
  @IsBoolean()
  hiddenFromShop?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  weightOz?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  lengthIn?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  widthIn?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  heightIn?: number | null;

  @IsOptional()
  @IsBoolean()
  trackStock?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  stockQuantity?: number;

  @IsOptional()
  @IsString()
  stockStatus?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  /** The product's web address (/shop/<slug>). Built from the name when left out. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  /** What search engines show as the title and description; the name and short description are used when empty. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  metaTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  metaDescription?: string | null;

  /** A PDF from the media library (such as the instructions), linked from the product page. */
  @IsOptional()
  @IsString()
  instructionsMediaId?: string | null;

  @IsOptional()
  @IsString()
  featuredMediaId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(['PHYSICAL', 'DIGITAL', 'MINUTE_PACK'])
  type?: 'PHYSICAL' | 'DIGITAL' | 'MINUTE_PACK';

  @IsOptional()
  @IsString()
  @IsIn(['NONE', 'ASTROLOGY_REPORT'])
  digitalDelivery?: 'NONE' | 'ASTROLOGY_REPORT';

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  regularPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  salePrice?: number | null;

  @IsOptional()
  @IsDateString()
  saleStartsAt?: string | null;

  @IsOptional()
  @IsDateString()
  saleEndsAt?: string | null;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minutesPack?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Leave the product out of the shop and its lists and filters; it can still be bought with its direct link. */
  @IsOptional()
  @IsBoolean()
  hiddenFromShop?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  weightOz?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  lengthIn?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  widthIn?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  heightIn?: number | null;

  @IsOptional()
  @IsBoolean()
  trackStock?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  stockQuantity?: number;

  @IsOptional()
  @IsString()
  stockStatus?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  /** The product's web address (/shop/<slug>). Built from the name when left out. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  /** What search engines show as the title and description; the name and short description are used when empty. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  metaTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  metaDescription?: string | null;

  /** A PDF from the media library (such as the instructions), linked from the product page. */
  @IsOptional()
  @IsString()
  instructionsMediaId?: string | null;

  @IsOptional()
  @IsString()
  featuredMediaId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];
}

export class CreateProductReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  rating!: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class ImportProductsDto {
  @IsArray()
  items!: Array<Record<string, unknown>>;
}

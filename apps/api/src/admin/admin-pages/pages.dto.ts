import {
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
} from 'class-validator';
import { SLUG_PATTERN } from '../admin-content/cms-content.util';

const FEATURED_IMAGE_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
};

export class CreatePageDto {
  @IsString()
  @IsNotEmpty()
  @Matches(SLUG_PATTERN, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  metaTitle?: string | null;

  @IsOptional()
  @IsString()
  metaDescription?: string | null;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsUrl(FEATURED_IMAGE_OPTIONS, { message: 'Featured image must be a valid URL' })
  featuredImageUrl?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  featuredMediaId?: string | null;

  @IsOptional()
  @IsDateString()
  publishedAt?: string | null;
}

export class UpdatePageDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(SLUG_PATTERN, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  metaTitle?: string | null;

  @IsOptional()
  @IsString()
  metaDescription?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;

  @IsOptional()
  @IsUrl(FEATURED_IMAGE_OPTIONS, { message: 'Featured image must be a valid URL' })
  featuredImageUrl?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  featuredMediaId?: string | null;

  @IsOptional()
  @IsDateString()
  publishedAt?: string | null;
}

export class BulkActionDto {
  @IsIn(['publish', 'unpublish', 'delete'])
  action!: string;

  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}

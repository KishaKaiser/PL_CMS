import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
} from 'class-validator';
import { normalizeSlug, SLUG_PATTERN } from '../admin-content/cms-content.util';

const FEATURED_IMAGE_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
};

export class CreatePostDto {
  @Transform(({ value }) => normalizeSlug(String(value ?? '')))
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
  excerpt?: string | null;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsUrl(FEATURED_IMAGE_OPTIONS, { message: 'Featured image must be a valid URL' })
  featuredImageUrl?: string | null;

  @IsOptional()
  @IsDateString()
  publishedAt?: string | null;

  @IsString()
  @IsNotEmpty()
  authorId!: string;
}

export class UpdatePostDto {
  @IsOptional()
  @Transform(({ value }) => normalizeSlug(String(value ?? '')))
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
  excerpt?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;

  @IsOptional()
  @IsUrl(FEATURED_IMAGE_OPTIONS, { message: 'Featured image must be a valid URL' })
  featuredImageUrl?: string | null;

  @IsOptional()
  @IsDateString()
  publishedAt?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  authorId?: string;
}

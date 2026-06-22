import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PUBLIC_SEARCH_LENGTH = 120;

const trimValue = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class PublicSlugParamDto {
  @Transform(trimValue)
  @IsString()
  @Matches(SLUG_PATTERN, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug!: string;
}

export class PublicAuthorParamDto {
  @Transform(trimValue)
  @IsString()
  @MaxLength(64)
  authorId!: string;
}

export class PublicPagesQueryDto {
  @Transform(trimValue)
  @IsOptional()
  @IsString()
  @Matches(SLUG_PATTERN, {
    message: 'excludeSlug must contain only lowercase letters, numbers, and hyphens',
  })
  excludeSlug?: string;
}

export class PublicPostsQueryDto {
  @Transform(trimValue)
  @IsOptional()
  @IsString()
  @MaxLength(MAX_PUBLIC_SEARCH_LENGTH)
  search?: string;

  @Transform(trimValue)
  @IsOptional()
  @IsString()
  @Matches(SLUG_PATTERN, {
    message: 'category must contain only lowercase letters, numbers, and hyphens',
  })
  category?: string;

  @Transform(trimValue)
  @IsOptional()
  @IsString()
  @Matches(SLUG_PATTERN, {
    message: 'tag must contain only lowercase letters, numbers, and hyphens',
  })
  tag?: string;

  @Transform(trimValue)
  @IsOptional()
  @IsString()
  @MaxLength(64)
  authorId?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1970)
  @Max(3000)
  year?: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;
}

export class CreatePostCommentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @Transform(trimValue)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

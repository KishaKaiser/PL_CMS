import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { SLUG_PATTERN } from '../admin-content/cms-content.util';

export class CreateTaxonomyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(SLUG_PATTERN, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug?: string;
}

export class UpdateTaxonomyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(SLUG_PATTERN, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug?: string;
}

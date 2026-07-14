import { IsIn, IsOptional, IsString } from 'class-validator';
import { TRANSIT_TYPES } from './astrology-blog.service';

export class GenerateBlogPostDto {
  @IsIn(TRANSIT_TYPES.map((t) => t.value))
  transitType!: string;

  @IsOptional()
  @IsString()
  additionalContext?: string;
}

export class PublishBlogPostDto {
  @IsString()
  title!: string;

  @IsString()
  content!: string;

  @IsString()
  slug!: string;

  @IsString()
  authorId!: string;

  @IsOptional()
  @IsString()
  publishedAt?: string;
}

import { IsIn, IsOptional, IsString } from 'class-validator';
import { TRANSIT_TYPES } from './astrology-blog.service';

export class GenerateBlogPostDto {
  @IsOptional()
  @IsIn(TRANSIT_TYPES.map((t) => t.value))
  transitType?: string;

  @IsOptional()
  @IsString()
  customTopic?: string;

  @IsOptional()
  @IsString()
  additionalContext?: string;
}

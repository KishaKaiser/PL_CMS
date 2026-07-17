import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class BirthDataDto {
  @IsString()
  name!: string;

  @IsString()
  date!: string;

  @IsString()
  time!: string;

  @IsString()
  city!: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsString()
  country!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class PreviewAstrologyChartDto extends BirthDataDto {}

export class TestOllamaConnectionDto {
  @IsOptional()
  @IsString()
  ollamaBaseUrl?: string;

  @IsOptional()
  @IsString()
  ollamaModel?: string;
}

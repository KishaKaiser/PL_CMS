import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class HoroscopePeriodDto {
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

export class UpdateHoroscopeDto {
  @IsOptional()
  @IsString()
  overview?: string;

  @IsOptional()
  @IsString()
  career?: string;

  @IsOptional()
  @IsString()
  money?: string;

  @IsOptional()
  @IsString()
  love?: string;
}

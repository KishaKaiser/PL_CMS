import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

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

export class SynastryChartDto {
  @ValidateNested()
  @Type(() => BirthDataDto)
  person1!: BirthDataDto;

  @ValidateNested()
  @Type(() => BirthDataDto)
  person2!: BirthDataDto;

  @IsIn(['romantic', 'friendship', 'business'])
  relationshipType!: 'romantic' | 'friendship' | 'business';
}

export class KarmicChartDto {
  @ValidateNested()
  @Type(() => BirthDataDto)
  person1!: BirthDataDto;

  @ValidateNested()
  @Type(() => BirthDataDto)
  person2!: BirthDataDto;
}

export class KarmicDebtDto {
  @ValidateNested()
  @Type(() => BirthDataDto)
  birthData!: BirthDataDto;

  @IsString()
  birthName!: string;
}

export class FamilyChartDto {
  @ValidateNested()
  @Type(() => BirthDataDto)
  person1!: BirthDataDto;

  @ValidateNested()
  @Type(() => BirthDataDto)
  person2!: BirthDataDto;

  @IsIn(['parent-child', 'sibling'])
  relationType!: 'parent-child' | 'sibling';
}

export class TransitDto {
  @IsOptional()
  @IsString()
  chartId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BirthDataDto)
  birthData?: BirthDataDto;

  @IsOptional()
  @IsString()
  asOfDate?: string;
}

export class ElectionalDto {
  @IsIn([
    'wedding',
    'business_launch',
    'surgery',
    'travel',
    'signing_contract',
    'moving',
    'investment',
    'interview',
    'first_date',
    'proposal',
    'purchase',
    'creative_project',
  ])
  eventType!: string;

  @IsString()
  startDate!: string;

  @IsString()
  endDate!: string;

  @IsString()
  location!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  avoidRetrograde?: boolean;
}

export class LifeEventDto {
  @IsIn(['marriage', 'child', 'career', 'relocation', 'accident', 'loss', 'education', 'financial', 'health', 'spiritual'])
  type!: string;

  @IsString()
  date!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class RectificationDto {
  @IsString()
  birthDate!: string;

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LifeEventDto)
  events!: LifeEventDto[];
}

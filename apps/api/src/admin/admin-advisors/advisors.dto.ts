import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAdvisorExtensionDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  sipExtension?: string;
}

import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class StartSessionDto {
  @IsString()
  advisorId!: string;
}

export class SetPhoneNumberDto {
  @IsString()
  @MaxLength(32)
  phoneNumber!: string;
}

export class SubmitReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

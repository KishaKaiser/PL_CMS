import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ModerateReviewDto {
  /** true hides the review from the public profile and the advisor's average; false shows it again. */
  @IsBoolean()
  hidden!: boolean;

  /** Why it was hidden. Only the admins see this. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

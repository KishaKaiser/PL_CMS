import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const MIN_WAIT_MINUTES = 5;
export const MAX_WAIT_MINUTES = 120;
export const DEFAULT_WAIT_MINUTES = 30;

export class JoinQueueDto {
  @IsString()
  advisorId!: string;

  /** How long the client is willing to wait; they are taken out of the line after this. */
  @IsOptional()
  @IsInt()
  @Min(MIN_WAIT_MINUTES)
  @Max(MAX_WAIT_MINUTES)
  maxWaitMinutes?: number;
}

import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const MIN_WAIT_MINUTES = 5;
/** 999 hours: what "wait for as long as it takes" means. */
export const MAX_WAIT_MINUTES = 999 * 60;
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

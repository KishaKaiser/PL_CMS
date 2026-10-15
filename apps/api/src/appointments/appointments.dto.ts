import { IsISO8601, IsString } from 'class-validator';

export class RequestAppointmentDto {
  @IsString()
  advisorId!: string;

  /** The requested call time as an ISO 8601 timestamp (the browser sends UTC). */
  @IsISO8601()
  scheduledAt!: string;
}

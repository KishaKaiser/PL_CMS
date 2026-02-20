import { IsString } from 'class-validator';

export class StartSessionDto {
  @IsString()
  advisorId!: string;
}

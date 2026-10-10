import { IsString, MaxLength } from 'class-validator';

export class StartSessionDto {
  @IsString()
  advisorId!: string;
}

export class SetPhoneNumberDto {
  @IsString()
  @MaxLength(32)
  phoneNumber!: string;
}

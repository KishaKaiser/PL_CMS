import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  recipientId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;
}

import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  recipientId!: string;

  /** Required for a new message. A reply may leave it out and gets "Re: ..." of the original's subject. */
  @IsOptional()
  @IsString()
  @MaxLength(150)
  subject?: string;

  /** The message this one answers; the reply joins its thread. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  inReplyToId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;
}

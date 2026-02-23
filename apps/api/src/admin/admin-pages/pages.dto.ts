import { IsString, IsOptional, IsDateString } from 'class-validator';

export class CreatePageDto {
  @IsString() slug: string;
  @IsString() title: string;
  @IsString() content: string;
  @IsOptional() @IsDateString() publishedAt?: string;
}

export class UpdatePageDto {
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() publishedAt?: string | null;
}

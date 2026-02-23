import { IsString, IsOptional, IsDateString } from 'class-validator';

export class CreatePostDto {
  @IsString() slug: string;
  @IsString() title: string;
  @IsOptional() @IsString() excerpt?: string;
  @IsString() content: string;
  @IsOptional() @IsDateString() publishedAt?: string;
  @IsString() authorId: string;
}

export class UpdatePostDto {
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() excerpt?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() publishedAt?: string | null;
}

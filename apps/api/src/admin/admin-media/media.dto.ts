import { IsOptional, IsString } from 'class-validator';

export class ListMediaDto {
  @IsOptional()
  @IsString()
  search?: string;
}

export class UploadMediaDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  altText?: string;
}

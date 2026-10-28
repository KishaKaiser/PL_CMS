import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** What the admin Email page saves. Every field is optional: only what is sent is changed. */
export class SaveEmailSettingsDto {
  @IsOptional()
  @IsIn(['icloud', 'custom'])
  provider?: 'icloud' | 'custom';

  @IsOptional()
  @IsString()
  @MaxLength(253)
  host?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsBoolean()
  secure?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  username?: string;

  /** Only sent when the password is being changed. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  password?: string;

  @IsOptional()
  @IsBoolean()
  clearPassword?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  fromName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  fromAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  notifyAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  siteUrl?: string;

  @IsOptional()
  @IsBoolean()
  notifyOnOrders?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyOnForms?: boolean;
}

export class SendTestEmailDto {
  @IsOptional()
  @IsString()
  @MaxLength(254)
  to?: string;
}

import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

/** The look of the emails. Used on its own for the preview, and as part of what the Email page saves. */
export class EmailDesignDto {
  @IsOptional()
  @IsString()
  @MaxLength(7)
  accentColor?: string;

  @IsOptional()
  @IsBoolean()
  showLogo?: boolean;

  @IsOptional()
  @IsBoolean()
  showSiteName?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  trackButtonLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  signature?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  footerText?: string;
}

/** What the admin Email page saves. Every field is optional: only what is sent is changed. */
export class SaveEmailSettingsDto extends EmailDesignDto {
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

/** The emails that can be previewed: the editable ones. */
export const PREVIEW_TEMPLATES = ['order_confirmation', 'order_progress', 'order_shipped', 'order_alert', 'form_alert'] as const;

export class PreviewEmailDto {
  @IsIn(PREVIEW_TEMPLATES)
  template!: (typeof PREVIEW_TEMPLATES)[number];

  /** Design changes not saved yet, so the preview shows what the page currently has. */
  @IsOptional()
  @ValidateNested()
  @Type(() => EmailDesignDto)
  design?: EmailDesignDto;
}

import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class SubscribeDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsBoolean()
  privacyConsent!: boolean;

  @IsBoolean()
  termsConsent!: boolean;
}

export class NewsletterSettingsDto {
  @IsBoolean()
  enabled!: boolean;

  @IsString()
  defaultTitle!: string;

  @IsString()
  defaultDescription!: string;

  @IsString()
  defaultButtonLabel!: string;

  @IsString()
  defaultPlaceholder!: string;

  @IsBoolean()
  collectName!: boolean;

  @IsString()
  privacyPolicyUrl!: string;

  @IsString()
  termsUrl!: string;

  @IsString()
  consentText!: string;

  @IsString()
  gdprNotice!: string;

  @IsString()
  retentionPolicy!: string;

  @IsString()
  successMessage!: string;

  @IsString()
  welcomeSubject!: string;

  @IsString()
  welcomeBody!: string;
}

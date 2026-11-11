import { DELIVERABLE_EMAIL_SOURCE, INVALID_EMAIL_MESSAGE } from '@pl-cms/shared';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class SubscribeDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @Matches(new RegExp(DELIVERABLE_EMAIL_SOURCE, 'u'), { message: INVALID_EMAIL_MESSAGE })
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

/** The unsubscribe link in a newsletter email: the address and the signature in the link. */
export class UnsubscribeDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(200)
  token!: string;
}

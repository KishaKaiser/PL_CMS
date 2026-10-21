import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Max, MaxLength, Min, MinLength } from 'class-validator';
import { MAX_RATE_PER_MINUTE, MIN_RATE_PER_MINUTE } from './onboarding.constants';

/** The public "Become an advisor" application. */
export class SubmitApplicationDto {
  @IsString()
  @Length(2, 120)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @Length(7, 30)
  phone!: string;

  @IsInt()
  @Min(0)
  @Max(80)
  yearsExperience!: number;

  /** "Tell us about your gifts and experience". */
  @IsString()
  @Length(10, 3000)
  gifts!: string;

  /** "Describe your reading style". */
  @IsString()
  @Length(10, 3000)
  readingStyle!: string;

  /** A trap for bots: real visitors never see this field, so it stays empty. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

export class RejectApplicationDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ActivateDto {
  @IsString()
  @Length(20, 200)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class DisplayNameDto {
  /** What clients see, such as "Psychic Denise". Becomes the username "psychic_denise". */
  @IsString()
  @Length(3, 30)
  displayName!: string;
}

export class RateDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(MIN_RATE_PER_MINUTE)
  @Max(MAX_RATE_PER_MINUTE)
  ratePerMinute!: number;
}

export class PaypalDto {
  @IsEmail()
  @MaxLength(254)
  paypalEmail!: string;
}

export class SignAgreementDto {
  @IsString()
  @Length(2, 120)
  professionalName!: string;

  /** The advisor's full name typed as their signature. */
  @IsString()
  @Length(2, 120)
  signature!: string;

  /** One tick for each statement in the acknowledgement; all must be true. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsBoolean({ each: true })
  acknowledgements!: boolean[];
}

export class W9Dto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessName?: string;

  @IsIn(['INDIVIDUAL', 'C_CORP', 'S_CORP', 'PARTNERSHIP', 'TRUST_ESTATE', 'LLC', 'OTHER'])
  classification!: 'INDIVIDUAL' | 'C_CORP' | 'S_CORP' | 'PARTNERSHIP' | 'TRUST_ESTATE' | 'LLC' | 'OTHER';

  @IsOptional()
  @IsIn(['C', 'S', 'P'])
  llcTaxClass?: 'C' | 'S' | 'P';

  @IsOptional()
  @IsString()
  @MaxLength(60)
  otherClassification?: string;

  @IsOptional()
  @IsBoolean()
  foreignPartners?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  exemptPayeeCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  fatcaCode?: string;

  @IsString()
  @Length(1, 100)
  address!: string;

  @IsString()
  @Length(1, 100)
  cityStateZip!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  accountNumbers?: string;

  @IsIn(['SSN', 'EIN'])
  tinType!: 'SSN' | 'EIN';

  /** Nine digits; dashes and spaces are ignored. */
  @IsString()
  @MaxLength(20)
  tin!: string;

  @IsString()
  @Length(2, 120)
  signature!: string;

  /** "Under penalties of perjury, I certify that..." */
  @IsBoolean()
  certify!: boolean;

  /** Ticked to confirm the IRS has not told them they are subject to backup withholding. */
  @IsBoolean()
  notBackupWithholding!: boolean;
}

export class DirectDepositDto {
  @IsString()
  @Length(2, 100)
  accountHolder!: string;

  @IsString()
  @Length(2, 100)
  bankName!: string;

  @IsIn(['CHECKING', 'SAVINGS'])
  accountType!: 'CHECKING' | 'SAVINGS';

  @IsString()
  @MaxLength(20)
  routingNumber!: string;

  @IsString()
  @MaxLength(30)
  accountNumber!: string;

  @IsString()
  @MaxLength(30)
  accountNumberConfirm!: string;

  @IsString()
  @Length(2, 120)
  signature!: string;

  @IsBoolean()
  authorize!: boolean;
}

export class AgreementSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60_000)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  representativeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  representativeTitle?: string;
}

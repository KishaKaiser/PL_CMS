import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}

export class SaveAddressDto {
  @IsString()
  @MaxLength(80)
  label!: string;

  @IsString()
  @MaxLength(120)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsString()
  @MaxLength(160)
  line1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  line2?: string;

  @IsString()
  @MaxLength(80)
  city!: string;

  @IsString()
  @MaxLength(40)
  state!: string;

  @IsString()
  @MaxLength(20)
  postalCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class SavePaymentMethodDto {
  @IsString()
  @MaxLength(80)
  label!: string;

  @IsString()
  @MaxLength(80)
  provider!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  last4?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAdvisorProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  profileImageUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ratePerMinute?: number;

  /** The advisor's own phone, called to connect them to a client. Empty clears it. */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phoneNumber?: string;

  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;
}

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

export class ScheduleSlotDto {
  /** 0 = Sunday … 6 = Saturday */
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @Matches(TIME_OF_DAY, { message: 'Times must look like 09:00' })
  startTime!: string;

  @Matches(TIME_OF_DAY, { message: 'Times must look like 17:00' })
  endTime!: string;
}

/** The advisor's usual weekly hours, shown on their public profile. Replaces whatever was saved before. */
export class UpdateAdvisorScheduleDto {
  /** An IANA time zone name such as "America/New_York": the zone the hours are in. */
  @IsString()
  @MaxLength(64)
  timezone!: string;

  @IsArray()
  @ArrayMaxSize(28)
  @ValidateNested({ each: true })
  @Type(() => ScheduleSlotDto)
  slots!: ScheduleSlotDto[];
}

export class SavePayoutMethodDto {
  @IsString()
  @MaxLength(80)
  label!: string;

  @IsString()
  @MaxLength(80)
  methodType!: string;

  @IsString()
  @MaxLength(120)
  accountName!: string;

  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

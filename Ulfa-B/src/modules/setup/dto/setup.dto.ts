import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ViewerAuthType } from '../../nfc-items/entities/nfc-item.entity';

const HEX_256 = /^[0-9a-f]{64}$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export const MIN_KDF_ITERATIONS = 100_000;
export const MAX_KDF_ITERATIONS = 5_000_000;
/** Ciphertext (base64) limits: generous for the plaintext they carry. */
const MAX_TEXT_CIPHERTEXT = 16_000;
const MAX_CAPTION_CIPHERTEXT = 2_000;

export class LockDto {
  @IsIn([ViewerAuthType.PIN, ViewerAuthType.DATE, ViewerAuthType.TEXT])
  viewerAuthType: ViewerAuthType;

  // Required for TEXT (checked by the service).
  @IsString()
  @MaxLength(200)
  @IsOptional()
  viewerAuthPrompt?: string;

  /** Key derived in the browser from the normalized answer (hex). */
  @Matches(HEX_256)
  authKey: string;

  @Matches(BASE64)
  @MaxLength(64)
  keySalt: string;

  @IsInt()
  @Min(MIN_KDF_ITERATIONS)
  @Max(MAX_KDF_ITERATIONS)
  kdfIterations: number;

  @Matches(BASE64)
  @MaxLength(128)
  wrappedKey: string;

  // Required on the first lock; omitted when only the answer changes.
  @Matches(BASE64)
  @MaxLength(128)
  @IsOptional()
  recoveryWrappedKey?: string;

  @Matches(HEX_256)
  @IsOptional()
  recoveryAuthKey?: string;
}

export class SessionDto {
  @Matches(HEX_256)
  authKey: string;
}

export class RecoverDto {
  @Matches(HEX_256)
  recoveryAuthKey: string;
}

export class SettingsDto {
  @IsIn(['ar', 'en'])
  language: string;
}

export class SectionChoiceDto {
  @IsString()
  @MaxLength(64)
  key: string;

  @IsBoolean()
  isVisible: boolean;
}

export class SectionsDto {
  /** Every section except the message, in the order the buyer chose. */
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SectionChoiceDto)
  sections: SectionChoiceDto[];
}

export class ContentDto {
  @Matches(BASE64)
  @MaxLength(MAX_TEXT_CIPHERTEXT)
  @IsOptional()
  title?: string;

  @Matches(BASE64)
  @MaxLength(MAX_TEXT_CIPHERTEXT)
  message: string;

  @Matches(BASE64)
  @MaxLength(MAX_TEXT_CIPHERTEXT)
  @IsOptional()
  signature?: string;
}

export class CreateMediaDto {
  @IsString()
  @MaxLength(64)
  sectionKey: string;

  /** Plaintext type, e.g. image/webp or audio/webm;codecs=opus. */
  @Matches(/^(image|audio)\/[a-z0-9.+-]+(;\s*codecs=[a-z0-9.,"-]+)?$/i)
  @MaxLength(100)
  mime: string;

  @IsInt()
  @Min(1)
  bytes: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  thumbBytes?: number;

  @IsInt()
  @Min(0)
  displayOrder: number;

  @Matches(BASE64)
  @MaxLength(MAX_CAPTION_CIPHERTEXT)
  @IsOptional()
  caption?: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsOptional()
  memoryDate?: string;
}

export class UpdateMediaDto {
  @Matches(BASE64)
  @MaxLength(MAX_CAPTION_CIPHERTEXT)
  @IsOptional()
  caption?: string | null;

  @IsInt()
  @Min(0)
  @IsOptional()
  displayOrder?: number;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsOptional()
  memoryDate?: string | null;
}

export class MediaOrderDto {
  @IsString()
  @MaxLength(64)
  sectionKey: string;

  @IsArray()
  @ArrayMaxSize(1000)
  @IsUUID('4', { each: true })
  ids: string[];
}

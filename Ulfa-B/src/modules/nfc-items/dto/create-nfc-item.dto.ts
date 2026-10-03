import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ViewerAuthType } from '../entities/nfc-item.entity';

export class CreateNfcItemDto {
  @IsUUID('4', { message: 'Invalid order ID format' })
  @IsNotEmpty({ message: 'orderId is required' })
  orderId: string;

  @IsString()
  @IsNotEmpty({ message: 'Product name is required' })
  productName: string;

  @IsString()
  @IsNotEmpty({ message: 'NFC ID is required' })
  nfcId: string;

  @IsUUID('4', { message: 'Invalid edit token format' })
  @IsOptional()
  editToken?: string;

  @IsString()
  @MinLength(6, {
    message: 'Creator password must be at least 6 characters long',
  })
  @IsOptional()
  creatorPassword?: string;

  @IsEnum(ViewerAuthType)
  @IsOptional()
  viewerAuthType?: ViewerAuthType;

  @IsString()
  @IsOptional()
  viewerAuthPrompt?: string;

  @IsString()
  @IsOptional()
  viewerPassword?: string;

  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z0-9][a-z0-9-]*$/i, {
    message: 'Theme must be a valid identifier',
  })
  @IsOptional()
  theme?: string;

  @IsString()
  @MaxLength(16)
  @Matches(/^[a-z]{2,3}(?:-[A-Z]{2})?$/i, {
    message: 'Language must be a valid language tag',
  })
  @IsOptional()
  language?: string;
}

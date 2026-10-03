import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  ValidateNested,
} from 'class-validator';
import {
  normalizePhoneNumber,
  PHONE_NUMBER_PATTERN,
} from '../../../common/utils/phone.util';

export class CreateMerchantOrderItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Item name is required' })
  @MaxLength(120)
  productName: string;
}

export class CreateMerchantOrderDto {
  @IsString()
  @IsNotEmpty({ message: 'Customer name is required' })
  @MaxLength(120)
  customerName: string;

  @Transform(({ value }) => normalizePhoneNumber(value))
  @Matches(PHONE_NUMBER_PATTERN, {
    message:
      'Customer phone must be +970/+972 followed by 9 digits starting with 5, or +962 followed by 9 digits starting with 7',
  })
  @IsNotEmpty({ message: 'Customer phone is required' })
  customerPhone: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  externalOrderId?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one NFC item is required' })
  @ArrayMaxSize(50, {
    message: 'A single order can contain at most 50 NFC items',
  })
  @ValidateNested({ each: true })
  @Type(() => CreateMerchantOrderItemDto)
  items: CreateMerchantOrderItemDto[];
}

import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
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

/**
 * SEPARATE: one link (and one quota unit) per item, the default.
 * SHARED: one link for all the items in the order; it uses one quota unit and
 * the same link is written to every gift.
 */
export const LINK_MODES = ['SEPARATE', 'SHARED'] as const;
export type LinkMode = (typeof LINK_MODES)[number];

/**
 * Fields shared by every order request. The phone is declared by each subclass
 * because class-validator applies a parent's decorators to an overriding
 * property too, so a subclass could not loosen the rule otherwise.
 */
export abstract class OrderRequestBaseDto {
  abstract customerPhone: string;

  @IsString()
  @IsNotEmpty({ message: 'Customer name is required' })
  @MaxLength(120)
  customerName: string;

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

  @IsOptional()
  @IsIn(LINK_MODES)
  linkMode?: LinkMode;
}

export class CreateMerchantOrderDto extends OrderRequestBaseDto {
  @Transform(({ value }) => normalizePhoneNumber(value))
  @Matches(PHONE_NUMBER_PATTERN, {
    message:
      'Customer phone must be +970/+972 followed by 9 digits starting with 5, or +962 followed by 9 digits starting with 7',
  })
  @IsNotEmpty({ message: 'Customer phone is required' })
  customerPhone: string;
}

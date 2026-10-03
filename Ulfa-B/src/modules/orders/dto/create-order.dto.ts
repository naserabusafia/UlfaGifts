import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import {
  normalizePhoneNumber,
  PHONE_NUMBER_PATTERN,
} from '../../../common/utils/phone.util';
import { OrderStatus } from '../entities/order.entity';

export class CreateOrderDto {
  @IsUUID('4', { message: 'Invalid merchant ID format' })
  @IsNotEmpty({ message: 'merchantId is required' })
  merchantId: string;

  @IsString()
  @IsNotEmpty({ message: 'Customer name is required' })
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
  externalOrderId?: string;

  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;
}

import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import {
  INTERNATIONAL_PHONE_NUMBER_PATTERN,
  normalizePhoneNumber,
} from '../../../common/utils/phone.util';
import { OrderRequestBaseDto } from './create-merchant-order.dto';

/**
 * Orders from connected stores can ship anywhere, so any E.164 mobile number
 * is accepted here, unlike the admin and merchant portal forms.
 */
export class CreateIntegrationOrderDto extends OrderRequestBaseDto {
  @Transform(({ value }) => normalizePhoneNumber(value))
  @Matches(INTERNATIONAL_PHONE_NUMBER_PATTERN, {
    message: 'Customer phone must be in international format, e.g. +491701234567',
  })
  @IsNotEmpty({ message: 'Customer phone is required' })
  customerPhone: string;

  @IsString()
  @IsNotEmpty({ message: 'externalOrderId is required for integration orders' })
  @MaxLength(120)
  declare externalOrderId: string;
}

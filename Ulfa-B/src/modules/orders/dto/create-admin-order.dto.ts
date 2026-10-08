import { IsBoolean, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { CreateMerchantOrderDto } from './create-merchant-order.dto';

/** A full order (items and links) that an admin creates for a merchant. */
export class CreateAdminOrderDto extends CreateMerchantOrderDto {
  @IsUUID('4', { message: 'Invalid merchant ID format' })
  @IsNotEmpty({ message: 'merchantId is required' })
  merchantId: string;

  // false: the links are free for the merchant; their quota is neither
  // checked nor used, and cancelling the order refunds nothing.
  @IsOptional()
  @IsBoolean()
  chargeQuota?: boolean;
}

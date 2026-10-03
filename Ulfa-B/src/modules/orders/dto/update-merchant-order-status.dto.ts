import { IsEnum } from 'class-validator';
import { OrderStatus } from '../entities/order.entity';

export class UpdateMerchantOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;
}


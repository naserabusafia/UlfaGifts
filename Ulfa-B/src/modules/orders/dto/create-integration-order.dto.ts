import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CreateMerchantOrderDto } from './create-merchant-order.dto';

export class CreateIntegrationOrderDto extends CreateMerchantOrderDto {
  @IsString()
  @IsNotEmpty({ message: 'externalOrderId is required for integration orders' })
  @MaxLength(120)
  declare externalOrderId: string;
}

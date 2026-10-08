import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Names an order by the Idempotency-Key the store created it with. */
export class CancelIntegrationOrderDto {
  @IsString()
  @IsNotEmpty({ message: 'idempotencyKey is required' })
  @MaxLength(128)
  idempotencyKey: string;
}

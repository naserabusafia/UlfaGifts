import { IsBoolean } from 'class-validator';

export class UpdateMerchantNfcLockDto {
  @IsBoolean()
  isLocked: boolean;
}


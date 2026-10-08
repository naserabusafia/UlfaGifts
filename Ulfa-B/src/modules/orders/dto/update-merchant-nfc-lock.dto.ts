import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMerchantNfcLockDto {
  @IsBoolean()
  isLocked: boolean;

  // Shown to the buyer and the recipient while locked; ignored on unlock.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(200)
  lockReason?: string;
}

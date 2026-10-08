import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { QuotaRequestStatus } from '../entities/quota-request.entity';

export const MAX_QUOTA_REQUEST = 100_000;

export class CreateQuotaRequestDto {
  @IsInt({ message: 'Amount must be a whole number' })
  @Min(1, { message: 'Amount must be at least 1' })
  @Max(MAX_QUOTA_REQUEST)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ApproveQuotaRequestDto {
  // Leave out to grant what the merchant asked for.
  @IsOptional()
  @IsInt({ message: 'Amount must be a whole number' })
  @Min(1, { message: 'Amount must be at least 1' })
  @Max(MAX_QUOTA_REQUEST)
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RejectQuotaRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class QuotaRequestsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(QuotaRequestStatus)
  status?: QuotaRequestStatus;

  @IsOptional()
  @IsUUID('4')
  merchantId?: string;
}

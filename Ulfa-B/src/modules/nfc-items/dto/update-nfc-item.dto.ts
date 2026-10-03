import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateNfcItemDto } from './create-nfc-item.dto';

export class UpdateNfcItemDto extends PartialType(CreateNfcItemDto) {
  @IsBoolean()
  @IsOptional()
  isLocked?: boolean;
}

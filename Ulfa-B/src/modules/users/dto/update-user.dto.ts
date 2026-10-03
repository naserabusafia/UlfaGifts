import { PartialType } from '@nestjs/mapped-types';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsInt()
  @Min(0)
  @IsOptional()
  usedLinks?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddQuotaDto {
  @IsInt()
  @IsNotEmpty({ message: 'Amount is required' })
  amount: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

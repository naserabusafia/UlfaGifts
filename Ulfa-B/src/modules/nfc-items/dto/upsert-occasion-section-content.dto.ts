import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpsertOccasionSectionContentDto {
  @IsUUID('4')
  occasionId: string;

  @IsString()
  @MaxLength(16)
  @Matches(/^[a-z]{2,3}(?:-[A-Z]{2})?$/i)
  language: string;

  @IsUUID('4')
  sectionId: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  message?: string;
}

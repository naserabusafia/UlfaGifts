import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpsertThemeSectionContentDto {
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z0-9][a-z0-9-]*$/i)
  theme: string;

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

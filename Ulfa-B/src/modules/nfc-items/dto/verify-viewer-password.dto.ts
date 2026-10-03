import { IsString } from 'class-validator';

export class VerifyViewerPasswordDto {
  @IsString()
  // NONE uses an empty answer; protected items are still checked by the service.
  answer: string;
}

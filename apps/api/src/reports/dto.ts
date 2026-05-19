import { IsOptional, IsString } from 'class-validator';

export class GenerateReportDraftDto {
  @IsOptional()
  @IsString()
  meetingContent?: string;
}

import { IsOptional, IsString } from 'class-validator';

export class ExtractDiscussionDto {
  @IsOptional()
  @IsString()
  meetingContent?: string;
}

import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumber, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @MaxLength(180)
  title!: string;

  @IsOptional()
  preparationSnapshot?: unknown;
}

export class TranscriptSegmentInputDto {
  @IsOptional()
  @IsString()
  speakerText?: string;

  @IsOptional()
  @IsString()
  startedAt?: string;

  @IsOptional()
  @IsString()
  endedAt?: string;

  @IsString()
  text!: string;

  @IsOptional()
  @IsIn(['manual', 'transcription', 'edited'])
  source?: string;

  @IsOptional()
  @IsNumber()
  sequence?: number;
}

export class UpdateSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  meetingContent?: string;

  @IsOptional()
  @IsString()
  @IsIn(['preparing', 'in_meeting', 'reviewing', 'finalized'])
  status?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranscriptSegmentInputDto)
  transcriptSegments?: TranscriptSegmentInputDto[];
}

export class MoveSessionDto {
  @IsString()
  threadId!: string;
}

export class FinalizeSessionDto {
  @IsOptional()
  content?: unknown;
}

export class UpdateActionItemDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  ownerText?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  riskLevel?: string;

  @IsOptional()
  @IsString()
  importance?: string;

  @IsOptional()
  @IsString()
  urgency?: string;
}

export class UpdateTranscriptSegmentDto {
  @IsOptional()
  @IsString()
  speakerText?: string;

  @IsOptional()
  @IsString()
  text?: string;
}

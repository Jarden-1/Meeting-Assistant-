import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export class AssistantTranscriptSnapshotDto {
  @IsOptional()
  @IsString()
  speakerText?: string;

  @IsOptional()
  @IsString()
  speaker?: string;

  @IsString()
  text!: string;

  @IsOptional()
  @IsString()
  time?: string;

  @IsOptional()
  @IsString()
  role?: string;
}

export class AssistantAskDto {
  @IsString()
  @MaxLength(4000)
  question!: string;

  @IsOptional()
  @IsString()
  inputMode?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssistantTranscriptSnapshotDto)
  liveTranscriptSnapshot?: AssistantTranscriptSnapshotDto[];
}

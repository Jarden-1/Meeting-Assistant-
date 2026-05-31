import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class TranscriptionSegmentDto {
  @IsOptional()
  @IsString()
  speakerText?: string;

  @IsString()
  text!: string;

  @IsOptional()
  @IsString()
  startedAt?: string;

  @IsOptional()
  @IsString()
  endedAt?: string;

  @IsOptional()
  @IsNumber()
  sequence?: number;

  @IsOptional()
  @IsNumber()
  confidence?: number;
}

export class CreateTranscriptionDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsNumber()
  durationSeconds?: number;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  mode?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranscriptionSegmentDto)
  segments?: TranscriptionSegmentDto[];
}

export class CreateTencentSessionDto {
  @IsOptional()
  @IsString()
  mode?: string;

  @IsOptional()
  @IsNumber()
  sampleRate?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hotwordList?: string[];
}

export class PersistTencentResultDto {
  @IsOptional()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  voiceId?: string;

  @IsOptional()
  @IsString()
  mode?: string;
}

export class CreateEnhancementChunkDto {
  @IsNumber()
  chunkIndex!: number;

  @IsNumber()
  audioStartMs!: number;

  @IsNumber()
  audioEndMs!: number;

  @IsOptional()
  @IsNumber()
  overlapMs?: number;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  audioBase64?: string;

  @IsOptional()
  @IsString()
  audioMimeType?: string;
}

export class EnhancementSegmentDto {
  @IsOptional()
  @IsString()
  localSpeaker?: string;

  @IsOptional()
  @IsString()
  speakerText?: string;

  @IsNumber()
  startMs!: number;

  @IsNumber()
  endMs!: number;

  @IsString()
  text!: string;

  @IsOptional()
  @IsNumber()
  confidence?: number;
}

export class CompleteEnhancementChunkDto {
  @IsOptional()
  @IsString()
  provider?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EnhancementSegmentDto)
  segments!: EnhancementSegmentDto[];
}

export class FailEnhancementChunkDto {
  @IsOptional()
  @IsString()
  @IsIn(['failed', 'canceled'])
  status?: string;

  @IsString()
  errorMessage!: string;
}

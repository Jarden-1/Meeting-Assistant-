import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

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

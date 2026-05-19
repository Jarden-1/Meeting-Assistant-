import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveCustomLlmDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  provider?: string;

  @IsString()
  @MaxLength(500)
  baseUrl!: string;

  @IsString()
  @MaxLength(120)
  model!: string;

  @IsString()
  @MaxLength(2000)
  apiKey!: string;
}

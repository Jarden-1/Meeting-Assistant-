import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AssistantAskDto {
  @IsString()
  @MaxLength(4000)
  question!: string;

  @IsOptional()
  @IsString()
  inputMode?: string;
}

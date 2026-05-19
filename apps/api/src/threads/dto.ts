import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ThreadQueryDto {
  @IsOptional()
  page?: number = 1;

  @IsOptional()
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  keyword?: string;
}

export class CreateThreadDto {
  @IsString()
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  background?: string;
}

export class UpdateThreadDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  background?: string;
}

export class CreateProgressUpdateDto {
  @IsString()
  @MaxLength(4000)
  content!: string;
}

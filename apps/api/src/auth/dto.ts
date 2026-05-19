import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class EnterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  entryName!: string;
}

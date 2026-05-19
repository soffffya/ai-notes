import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsString()
  @MaxLength(10000)
  content!: string;
}

import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;
}

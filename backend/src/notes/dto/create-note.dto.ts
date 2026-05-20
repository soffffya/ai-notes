import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsString()
  @MaxLength(10000)
  content!: string;
}

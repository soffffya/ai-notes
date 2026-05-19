import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateListItemDto {
  @IsString()
  @MaxLength(240)
  text!: string;

  @IsOptional()
  @IsString()
  noteId?: string;
}

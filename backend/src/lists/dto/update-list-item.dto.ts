import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateListItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  text?: string;

  @IsOptional()
  @IsBoolean()
  done?: boolean;
}

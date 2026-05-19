import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class ReorderListItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  itemIds!: string[];
}

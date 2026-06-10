import { IsString, IsNotEmpty, IsNumber, IsPositive, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFoodItemDto {
  @ApiProperty({ example: 'Iced Peach Tea', description: 'The name of the food/drink item' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Refreshing peach flavored black tea with real peach slices', description: 'The detailed description of the item' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 45000, description: 'The price of the item' })
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiProperty({ type: [String], example: ['https://example.com/item1.jpg', 'https://example.com/item2.jpg'], required: false, description: 'Images of the food item' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

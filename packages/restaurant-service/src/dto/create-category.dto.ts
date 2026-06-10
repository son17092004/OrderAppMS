import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Beverages', description: 'The name of the menu category' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

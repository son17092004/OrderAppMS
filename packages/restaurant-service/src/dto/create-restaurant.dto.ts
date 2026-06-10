import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRestaurantDto {
  @ApiProperty({ example: 'Golden Dragon Restaurant', description: 'The name of the restaurant' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '123 Main Street, Hanoi', description: 'The physical address of the restaurant' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: '0987654321', description: 'The contact phone number of the restaurant' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ type: [String], example: ['https://example.com/res1.jpg', 'https://example.com/res2.jpg'], required: false, description: 'Images of the restaurant' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

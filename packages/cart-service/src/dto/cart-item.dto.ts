import { IsUUID, IsInt, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CartItemDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'The UUID of the food item' })
  @IsUUID(4, { message: 'Invalid food item ID' })
  foodItemId: string;

  @ApiProperty({ example: 2, description: 'The quantity of the food item to add/update' })
  @IsInt({ message: 'Quantity must be an integer' })
  @IsPositive({ message: 'Quantity must be positive' })
  quantity: number;
}

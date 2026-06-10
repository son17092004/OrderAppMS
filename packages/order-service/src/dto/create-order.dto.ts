import { IsString, IsOptional } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  @IsOptional()
  deliveryAddress?: string;

  @IsString()
  @IsOptional()
  phone?: string;
}

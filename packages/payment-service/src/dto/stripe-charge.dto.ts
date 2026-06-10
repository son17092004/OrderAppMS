import { IsString, IsNotEmpty, IsNumber, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StripeChargeDto {
  @ApiProperty({ example: 'order-uuid-here', description: 'The ID of the order being paid' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ example: 'tok_visa', description: 'Mock Stripe token (e.g. tok_visa, tok_chargeDeclined)' })
  @IsString()
  @IsNotEmpty()
  stripeToken: string;

  @ApiProperty({ example: 120.50, description: 'The payment amount' })
  @IsNumber()
  @IsPositive()
  amount: number;
}

import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { StripeChargeDto } from './dto/stripe-charge.dto';
import { StandardResponse, HttpAuthGuard, RolesGuard, Roles, User, AuthenticatedUser } from '@food-ordering/common';

@ApiTags('Payments')
@Controller({ path: 'payments', version: '1' })
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('stripe/charge')
  @UseGuards(HttpAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Charge a Stripe payment for an order (Mock)',
    description: `
**Mock Stripe tokens:**
- \`tok_visa\` — Visa card, always succeeds
- \`tok_mastercard\` — Mastercard, always succeeds
- \`tok_chargeDeclined\` — Card declined (payment fails)
- \`tok_chargeDeclinedExpiredCard\` — Expired card (payment fails)
    `,
  })
  @ApiBody({ type: StripeChargeDto })
  @ApiResponse({ status: 201, description: 'Stripe payment processed (check success flag in response).' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async stripeCharge(@Body() dto: StripeChargeDto, @User() user: AuthenticatedUser) {
    const result = await this.paymentService.processStripePayment(dto.orderId, dto.stripeToken, dto.amount);
    const message = result.success ? 'Payment succeeded' : 'Payment declined by Stripe';
    return StandardResponse.success(message, result);
  }

  @Get('order/:orderId')
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment details for a specific order (Admin only)' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Payment details retrieved successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Requires ADMIN role.' })
  @ApiResponse({ status: 404, description: 'Payment record not found.' })
  async getPaymentDetails(@Param('orderId') orderId: string) {
    const payment = await this.paymentService.getPaymentByOrderId(orderId);
    return StandardResponse.success('Payment log retrieved successfully', payment);
  }

  @EventPattern('OrderCreated')
  async handleOrderCreated(@Payload() message: any) {
    const data = typeof message === 'string' ? JSON.parse(message) : message;
    await this.paymentService.processOrderPayment(data.orderId, data.userId, data.amount);
  }
}

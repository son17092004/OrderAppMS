import { Controller, Get, Post, Body, Param, UseGuards, ForbiddenException, NotFoundException } from '@nestjs/common';
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
    summary: 'Charge a Stripe payment for an order',
    description: `
**Stripe test tokens:**
- \`tok_visa\` — Visa card, always succeeds
- \`tok_mastercard\` — Mastercard, always succeeds
- \`tok_chargeDeclined\` — Card declined (payment fails)
- Or use real Stripe.js token from CardElement
    `,
  })
  @ApiBody({ type: StripeChargeDto })
  @ApiResponse({ status: 201, description: 'Stripe payment processed (check success flag in response).' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async stripeCharge(@Body() dto: StripeChargeDto, @User() user: AuthenticatedUser) {
    const result = await this.paymentService.processStripePayment(dto.orderId, dto.stripeToken, dto.amount, user.id);
    const message = result.success ? 'Payment succeeded' : 'Payment declined by Stripe';
    return StandardResponse.success(message, result);
  }

  @Get('my')
  @UseGuards(HttpAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all payments of the current user (Customer)' })
  @ApiResponse({ status: 200, description: 'Payment history retrieved.' })
  async getMyPayments(@User() user: AuthenticatedUser) {
    const payments = await this.paymentService.getMyPayments(user.id);
    return StandardResponse.success('Payment history retrieved', payments);
  }

  @Get('order/:orderId')
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('ADMIN', 'RESTAURANT_OWNER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment details for a specific order (Admin/Owner only)' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Payment details retrieved successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Not authorized.' })
  @ApiResponse({ status: 404, description: 'Payment record not found.' })
  async getPaymentDetails(@Param('orderId') orderId: string, @User() user: AuthenticatedUser) {
    const payment = await this.paymentService.getPaymentByOrderId(orderId);
    if (!payment) {
      throw new NotFoundException('Payment record not found');
    }

    if (user.role === 'RESTAURANT_OWNER') {
      try {
        const orderRes = await fetch(`http://order-service:3004/v1/orders/${orderId}`, {
          headers: {
            'x-user-id': user.id,
            'x-user-email': user.email,
            'x-user-role': user.role,
          }
        });
        const orderData = await orderRes.json() as any;
        if (!orderRes.ok || !orderData.success) {
          throw new ForbiddenException('You do not have access to this order details');
        }

        const restaurantId = orderData.data.restaurantId;
        const resResponse = await fetch(`http://restaurant-service:3002/v1/restaurants/${restaurantId}`);
        const resData = await resResponse.json() as any;
        if (!resResponse.ok || !resData.success) {
          throw new ForbiddenException('Failed to verify restaurant ownership');
        }

        if (resData.data.ownerId !== user.id) {
          throw new ForbiddenException('You do not own the restaurant associated with this order');
        }
      } catch (err: any) {
        if (err instanceof ForbiddenException) throw err;
        throw new ForbiddenException(`Access validation error: ${err.message}`);
      }
    }

    return StandardResponse.success('Payment log retrieved successfully', payment);
  }

  // ─── Kafka Event Handlers ────────────────────────────────────────────────────

  @EventPattern('OrderCreated')
  async handleOrderCreated(@Payload() message: any) {
    const data = typeof message === 'string' ? JSON.parse(message) : message;
    await this.paymentService.processOrderPayment(data.orderId, data.userId, data.amount);
  }

  @EventPattern('OrderCancelled')
  async handleOrderCancelled(@Payload() message: any) {
    const data = typeof message === 'string' ? JSON.parse(message) : message;
    await this.paymentService.handleOrderCancelled(data);
  }
}

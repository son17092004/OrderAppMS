import { Controller, Post, Get, Param, UseGuards } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { OrderService } from './order.service';
import { StandardResponse, HttpAuthGuard, RolesGuard, Roles, User, AuthenticatedUser } from '@food-ordering/common';

@ApiTags('Orders')
@Controller({ path: 'orders', version: '1' })
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post('checkout')
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Checkout and place an order from the current shopping cart (Customer only)' })
  @ApiResponse({ status: 201, description: 'Order placed successfully. Saga initiated (Payment and Notifications).' })
  @ApiResponse({ status: 400, description: 'Empty cart or invalid item quantities.' })
  async checkout(@User() user: AuthenticatedUser) {
    const order = await this.orderService.checkout(user.id, user.email);
    return StandardResponse.success('Order placed successfully. Processing payment...', order);
  }

  @Get()
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('CUSTOMER', 'RESTAURANT_OWNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve order history of the current user' })
  @ApiResponse({ status: 200, description: 'Order history retrieved successfully.' })
  async getHistory(@User() user: AuthenticatedUser) {
    const orders = await this.orderService.findByUser(user.id);
    return StandardResponse.success('Order history retrieved successfully', orders);
  }

  @Get('management')
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('RESTAURANT_OWNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve orders for management (Owner or Admin)' })
  @ApiResponse({ status: 200, description: 'Management orders retrieved successfully.' })
  async getManagementOrders(@User() user: AuthenticatedUser) {
    const orders = await this.orderService.getManagementOrders(user);
    return StandardResponse.success('Management orders retrieved successfully', orders);
  }

  @Get(':id')
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('CUSTOMER', 'RESTAURANT_OWNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get details of a specific order by ID' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order details retrieved successfully.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  async getDetails(@Param('id') id: string) {
    const order = await this.orderService.findById(id);
    return StandardResponse.success('Order details retrieved successfully', order);
  }

  @EventPattern('PaymentCompleted')
  async handlePaymentCompleted(@Payload() message: any) {
    const data = typeof message === 'string' ? JSON.parse(message) : message;
    await this.orderService.handlePaymentCompleted(data.orderId, data.paymentId, data.transactionId);
  }

  @EventPattern('PaymentFailed')
  async handlePaymentFailed(@Payload() message: any) {
    const data = typeof message === 'string' ? JSON.parse(message) : message;
    await this.orderService.handlePaymentFailed(data.orderId, data.reason);
  }
}

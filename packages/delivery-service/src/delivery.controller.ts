import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { DeliveryService } from './delivery.service';
import { StandardResponse, HttpAuthGuard, RolesGuard, Roles, User, AuthenticatedUser } from '@food-ordering/common';
import { IsString, IsNotEmpty } from 'class-validator';

class FailDeliveryDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

@ApiTags('Deliveries')
@Controller({ path: 'deliveries', version: '1' })
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get('available')
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('DRIVER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get list of orders waiting for a driver (Driver only)' })
  @ApiResponse({ status: 200, description: 'Available deliveries retrieved.' })
  async getAvailableDeliveries() {
    const list = await this.deliveryService.getAvailableDeliveries();
    return StandardResponse.success('Available deliveries retrieved', list);
  }

  @Get('driver')
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('DRIVER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get list of deliveries accepted by the current driver (Driver only)' })
  @ApiResponse({ status: 200, description: 'Driver deliveries list.' })
  async getDriverDeliveries(@User() user: AuthenticatedUser) {
    const list = await this.deliveryService.getDriverDeliveries(user.id);
    return StandardResponse.success('Driver deliveries retrieved', list);
  }

  @Get('order/:orderId')
  @UseGuards(HttpAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get delivery details for an order' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Delivery details retrieved.' })
  @ApiResponse({ status: 404, description: 'Delivery record not found.' })
  async getDeliveryDetails(@Param('orderId') orderId: string) {
    const delivery = await this.deliveryService.getDeliveryByOrderId(orderId);
    return StandardResponse.success('Delivery details retrieved', delivery);
  }

  @Post('accept/:orderId')
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('DRIVER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Driver accepts to ship an order (Driver only)' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order accepted for delivery.' })
  async acceptDelivery(@Param('orderId') orderId: string, @User() user: AuthenticatedUser) {
    const delivery = await this.deliveryService.assignDriver(orderId, user.id);
    return StandardResponse.success('Order accepted successfully', delivery);
  }

  @Post('complete/:orderId')
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('DRIVER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Driver completes delivery of an order (Driver only)' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Delivery completed successfully.' })
  async completeDelivery(@Param('orderId') orderId: string, @User() user: AuthenticatedUser) {
    const delivery = await this.deliveryService.completeDelivery(orderId, user.id);
    return StandardResponse.success('Delivery marked as completed', delivery);
  }

  @Post('fail/:orderId')
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('DRIVER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Driver reports delivery failed (Driver only)' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiBody({ type: FailDeliveryDto })
  @ApiResponse({ status: 200, description: 'Delivery marked as failed.' })
  async failDelivery(
    @Param('orderId') orderId: string,
    @Body() dto: FailDeliveryDto,
    @User() user: AuthenticatedUser
  ) {
    const delivery = await this.deliveryService.failDelivery(orderId, user.id, dto.reason);
    return StandardResponse.success('Delivery marked as failed', delivery);
  }

  // Kafka Event Handlers
  @EventPattern('OrderCreated')
  async handleOrderCreated(@Payload() message: any) {
    const data = typeof message === 'string' ? JSON.parse(message) : message;
    await this.deliveryService.handleOrderCreated(data);
  }

  @EventPattern('PaymentCompleted')
  async handlePaymentCompleted(@Payload() message: any) {
    const data = typeof message === 'string' ? JSON.parse(message) : message;
    await this.deliveryService.handlePaymentCompleted(data);
  }

  // Saga Compensation: huỷ delivery khi order bị cancel (ví dụ: payment thất bại)
  @EventPattern('OrderCancelled')
  async handleOrderCancelled(@Payload() message: any) {
    const data = typeof message === 'string' ? JSON.parse(message) : message;
    await this.deliveryService.handleOrderCancelled(data);
  }
}

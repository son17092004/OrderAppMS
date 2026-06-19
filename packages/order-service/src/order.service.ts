import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientKafka } from '@nestjs/microservices';
import { OrderRepository } from './repositories/order.repository';
import { Order, OrderStatus } from './entities/order.entity';
import { 
  OrderCreatedEvent, 
  OrderConfirmedEvent, 
  OrderCancelledEvent, 
  NotificationRequestedEvent,
  JsonLogger,
  AuthenticatedUser
} from '@food-ordering/common';

@Injectable()
export class OrderService {
  private readonly cartServiceUrl: string;

  constructor(
    private readonly orderRepository: OrderRepository,
    @Inject('KAFKA_CLIENT') private readonly kafkaClient: ClientKafka,
    private readonly configService: ConfigService,
    private readonly logger: JsonLogger,
  ) {
    this.cartServiceUrl = this.configService.get<string>('CART_SERVICE_URL', 'http://localhost:3003');
    this.logger.setContext(OrderService.name);
  }

  async checkout(userId: string, userEmail: string): Promise<Order> {
    this.logger.log(`Initiating checkout for user ${userId} (${userEmail})`, 'Checkout');

    let cart;
    try {
      const res = await fetch(`${this.cartServiceUrl}/v1/cart/internal/${userId}`);
      if (!res.ok) {
        throw new BadRequestException('Failed to retrieve cart details');
      }
      cart = await res.json();
    } catch (err) {
      throw new BadRequestException(`Cart service error: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!cart || !cart.restaurantId || cart.items.length === 0) {
      throw new BadRequestException('Shopping cart is empty');
    }

    // Resolve restaurant name from restaurant-service
    let restaurantName = 'Unknown Restaurant';
    try {
      const restRes = await fetch(`http://restaurant-service:3002/v1/restaurants/${cart.restaurantId}`);
      if (restRes.ok) {
        const restData = await restRes.json() as any;
        if (restData && restData.data && restData.data.name) {
          restaurantName = restData.data.name;
        }
      }
    } catch (err: any) {
      this.logger.error(`Failed to resolve restaurant name during checkout: ${err.message}`);
    }

    const order = await this.orderRepository.createOrder(
      userId,
      userEmail,
      cart.restaurantId,
      restaurantName,
      cart.totalPrice,
      cart.items
    );

    this.logger.log(`Order ${order.id} reserved with PENDING_PAYMENT status`, 'Checkout');

    try {
      await fetch(`${this.cartServiceUrl}/v1/cart/internal/${userId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      this.logger.error(`Failed to clear cart for user ${userId} after order creation: ${err instanceof Error ? err.message : String(err)}`);
    }

    const event = new OrderCreatedEvent(
      order.id,
      order.userId,
      order.restaurantId,
      order.totalAmount,
      order.items.map(item => ({
        foodItemId: item.foodItemId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      }))
    );

    this.kafkaClient.emit('OrderCreated', JSON.stringify(event));
    this.logger.log(`Published OrderCreated event for Order ${order.id}`, 'Checkout');

    return order;
  }

  async findById(id: string): Promise<Order> {
    const order = await this.orderRepository.findById(id);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async findByUser(userId: string): Promise<Order[]> {
    this.logger.log(`Fetching orders for Customer ${userId}`, 'GetOrders');
    return this.orderRepository.findByUserId(userId);
  }

  async enrichOrders(orders: Order[]): Promise<Order[]> {
    const userIdsWithNoEmail = [...new Set(
      orders.filter(o => !o.userEmail).map(o => o.userId)
    )];

    const emailMap = new Map<string, string>();
    if (userIdsWithNoEmail.length > 0) {
      await Promise.all(
        userIdsWithNoEmail.map(async (userId) => {
          try {
            const res = await fetch(`http://auth-service:3001/v1/auth/users/${userId}`);
            if (res.ok) {
              const data = await res.json() as any;
              if (data && data.data && data.data.email) {
                emailMap.set(userId, data.data.email);
              }
            }
          } catch (err: any) {
            this.logger.error(`Failed to resolve email for user ${userId}: ${err.message}`);
          }
        })
      );
    }

    return orders.map(o => {
      if (!o.userEmail && emailMap.has(o.userId)) {
        o.userEmail = emailMap.get(o.userId)!;
      }
      return o;
    });
  }

  async getManagementOrders(user: AuthenticatedUser): Promise<Order[]> {
    if (user.role === 'ADMIN') {
      this.logger.log(`Fetching all orders for Admin management`, 'GetManagementOrders');
      const orders = await this.orderRepository.findAll();
      return this.enrichOrders(orders);
    }

    if (user.role === 'RESTAURANT_OWNER') {
      this.logger.log(`Fetching orders for Restaurant Owner management: ${user.id}`, 'GetManagementOrders');
      try {
        const res = await fetch('http://restaurant-service:3002/v1/restaurants');
        if (!res.ok) {
          throw new Error('Failed to fetch restaurants');
        }
        const data = await res.json() as any;
        const ownedRestaurants = (data.data || []).filter((r: any) => r.ownerId === user.id);
        const restaurantIds = ownedRestaurants.map((r: any) => r.id);
        
        const orders = await this.orderRepository.findByRestaurantIds(restaurantIds);
        return this.enrichOrders(orders);
      } catch (err: any) {
        this.logger.error(`Failed to resolve owner restaurants for management: ${err.message}`);
        return [];
      }
    }

    return [];
  }

  async handlePaymentCompleted(orderId: string, paymentId: string, transactionId: string): Promise<void> {
    this.logger.log(`Consuming PaymentCompleted event for Order ${orderId}`, 'Saga');

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      this.logger.error(`Order ${orderId} not found during PaymentCompleted processing`);
      return;
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      this.logger.warn(`Order ${orderId} has status ${order.status}, ignoring PaymentCompleted`);
      return;
    }

    await this.orderRepository.updateStatus(orderId, OrderStatus.CONFIRMED);
    this.logger.log(`Order ${orderId} updated to CONFIRMED status`, 'Saga');

    const confirmedEvent = new OrderConfirmedEvent(order.id, order.userId, order.restaurantId);
    this.kafkaClient.emit('OrderConfirmed', JSON.stringify(confirmedEvent));
    this.logger.log(`Published OrderConfirmed event for Order ${orderId}`, 'Saga');

    const notificationEvent = new NotificationRequestedEvent(
      order.userId,
      order.id,
      'EMAIL',
      `Your payment of $${order.totalAmount} was successful! Your order has been confirmed.`
    );
    this.kafkaClient.emit('NotificationRequested', JSON.stringify(notificationEvent));
    this.logger.log(`Published NotificationRequested event for Order ${orderId}`, 'Saga');
  }

  async handlePaymentFailed(orderId: string, reason: string): Promise<void> {
    this.logger.log(`Consuming PaymentFailed event for Order ${orderId}: ${reason}`, 'Saga');

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      this.logger.error(`Order ${orderId} not found during PaymentFailed processing`);
      return;
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      this.logger.warn(`Order ${orderId} has status ${order.status}, ignoring PaymentFailed`);
      return;
    }

    await this.orderRepository.updateStatus(orderId, OrderStatus.CANCELLED);
    this.logger.log(`Compensation executed: Order ${orderId} cancelled due to payment failure`, 'Saga');

    const cancelledEvent = new OrderCancelledEvent(order.id, reason);
    this.kafkaClient.emit('OrderCancelled', JSON.stringify(cancelledEvent));
    this.logger.log(`Published OrderCancelled event for Order ${orderId}`, 'Saga');

    const notificationEvent = new NotificationRequestedEvent(
      order.userId,
      order.id,
      'EMAIL',
      `Your order could not be placed because payment failed. Reason: ${reason}`
    );
    this.kafkaClient.emit('NotificationRequested', JSON.stringify(notificationEvent));
    this.logger.log(`Published NotificationRequested event for Order ${orderId}`, 'Saga');
  }
}

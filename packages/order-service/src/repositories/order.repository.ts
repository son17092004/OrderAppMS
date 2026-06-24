import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Order, OrderStatus } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';

@Injectable()
export class OrderRepository {
  constructor(
    @InjectRepository(Order)
    private readonly typeOrmOrderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly typeOrmOrderItemRepository: Repository<OrderItem>,
  ) {}

  async createOrder(
    userId: string,
    userEmail: string,
    restaurantId: string,
    restaurantName: string,
    totalAmount: number,
    items: Array<{ foodItemId: string; name: string; price: number; quantity: number }>,
    deliveryAddress?: string
  ): Promise<Order> {
    const order = this.typeOrmOrderRepository.create({
      userId,
      userEmail,
      restaurantId,
      restaurantName,
      totalAmount,
      deliveryAddress: deliveryAddress || 'No Address Provided',
      status: OrderStatus.PENDING_PAYMENT,
    });

    order.items = items.map(item => this.typeOrmOrderItemRepository.create({
      foodItemId: item.foodItemId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    }));

    return this.typeOrmOrderRepository.save(order);
  }

  async findById(id: string): Promise<Order | null> {
    return this.typeOrmOrderRepository.findOne({
      where: { id },
      relations: { items: true },
    });
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order | null> {
    await this.typeOrmOrderRepository.update(id, { status });
    return this.findById(id);
  }

  async findByUserId(userId: string): Promise<Order[]> {
    return this.typeOrmOrderRepository.find({
      where: { userId },
      relations: { items: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(): Promise<Order[]> {
    return this.typeOrmOrderRepository.find({
      relations: { items: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findByRestaurantIds(restaurantIds: string[]): Promise<Order[]> {
    if (restaurantIds.length === 0) return [];
    return this.typeOrmOrderRepository.find({
      where: { restaurantId: In(restaurantIds) },
      relations: { items: true },
      order: { createdAt: 'DESC' },
    });
  }
}

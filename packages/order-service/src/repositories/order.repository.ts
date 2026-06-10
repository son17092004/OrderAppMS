import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    restaurantId: string,
    totalAmount: number,
    items: Array<{ foodItemId: string; name: string; price: number; quantity: number }>
  ): Promise<Order> {
    const order = this.typeOrmOrderRepository.create({
      userId,
      restaurantId,
      totalAmount,
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
}

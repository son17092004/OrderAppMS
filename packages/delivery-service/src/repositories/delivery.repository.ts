import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Delivery, DeliveryStatus } from '../entities/delivery.entity';

@Injectable()
export class DeliveryRepository {
  constructor(
    @InjectRepository(Delivery)
    public readonly typeOrmDeliveryRepository: Repository<Delivery>,
  ) {}

  async createDelivery(
    orderId: string,
    restaurantId?: string,
    restaurantName?: string,
    userId?: string,
    userEmail?: string,
    deliveryAddress?: string
  ): Promise<Delivery> {
    const delivery = this.typeOrmDeliveryRepository.create({
      orderId,
      restaurantId,
      restaurantName,
      userId,
      userEmail,
      deliveryAddress: deliveryAddress || 'No Address Provided',
      status: DeliveryStatus.PENDING,
    });
    return this.typeOrmDeliveryRepository.save(delivery);
  }

  async updateOldDeliveryDetails(
    id: string,
    details: { restaurantId: string; restaurantName: string; userId: string; userEmail: string; deliveryAddress?: string }
  ): Promise<void> {
    await this.typeOrmDeliveryRepository.update(id, details);
  }

  async updateStatus(
    id: string,
    status: DeliveryStatus,
    reason?: string
  ): Promise<Delivery | null> {
    await this.typeOrmDeliveryRepository.update(id, {
      status,
      reason,
    });
    return this.findById(id);
  }

  async assignDriver(
    id: string,
    driverId: string,
    status: DeliveryStatus
  ): Promise<Delivery | null> {
    await this.typeOrmDeliveryRepository.update(id, {
      driverId,
      status,
    });
    return this.findById(id);
  }

  async findById(id: string): Promise<Delivery | null> {
    return this.typeOrmDeliveryRepository.findOne({ where: { id } });
  }

  async findByOrderId(orderId: string): Promise<Delivery | null> {
    return this.typeOrmDeliveryRepository.findOne({ where: { orderId } });
  }

  async findAvailableDeliveries(): Promise<Delivery[]> {
    return this.typeOrmDeliveryRepository.find({
      where: {
        status: DeliveryStatus.ASSIGNED,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findDriverDeliveries(driverId: string): Promise<Delivery[]> {
    return this.typeOrmDeliveryRepository.find({
      where: {
        driverId,
      },
      order: {
        updatedAt: 'DESC',
      },
    });
  }
}

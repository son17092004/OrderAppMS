import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum DeliveryStatus {
  PENDING = 'PENDING', // Chờ thanh toán / Chờ xử lý đơn
  ASSIGNED = 'ASSIGNED', // Đã thanh toán, đang chờ tài xế nhận đơn
  PICKED_UP = 'PICKED_UP', // Tài xế đã nhận đơn và đang đi giao
  DELIVERED = 'DELIVERED', // Đã giao thành công
  CANCELLED = 'CANCELLED', // Giao thất bại / Đơn bị hủy
}

@Entity('deliveries')
export class Delivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', unique: true })
  orderId: string;

  @Column({ name: 'driver_id', nullable: true })
  driverId: string;

  @Column({ name: 'restaurant_id', nullable: true })
  restaurantId: string;

  @Column({ name: 'restaurant_name', nullable: true })
  restaurantName: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @Column({ name: 'user_email', nullable: true })
  userEmail: string;

  @Column({ name: 'delivery_address', nullable: true })
  deliveryAddress: string;

  @Column({
    type: 'enum',
    enum: DeliveryStatus,
    default: DeliveryStatus.PENDING,
  })
  status: DeliveryStatus;

  @Column({ nullable: true })
  reason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from '../entities/payment.entity';

@Injectable()
export class PaymentRepository {
  constructor(
    @InjectRepository(Payment)
    private readonly typeOrmPaymentRepository: Repository<Payment>,
  ) {}

  async createPayment(orderId: string, userId: string, amount: number): Promise<Payment> {
    const payment = this.typeOrmPaymentRepository.create({
      orderId,
      userId,
      amount,
      status: PaymentStatus.PENDING,
    });
    return this.typeOrmPaymentRepository.save(payment);
  }

  async updateStatus(
    id: string,
    status: PaymentStatus,
    transactionId?: string,
    failureReason?: string
  ): Promise<Payment | null> {
    await this.typeOrmPaymentRepository.update(id, {
      status,
      transactionId,
      failureReason,
    });
    return this.findById(id);
  }

  async findById(id: string): Promise<Payment | null> {
    return this.typeOrmPaymentRepository.findOne({ where: { id } });
  }

  async findByOrderId(orderId: string): Promise<Payment | null> {
    return this.typeOrmPaymentRepository.findOne({ where: { orderId } });
  }
}

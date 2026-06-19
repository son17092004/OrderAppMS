import { Injectable, Inject } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { PaymentRepository } from './repositories/payment.repository';
import { PaymentStatus } from './entities/payment.entity';
import { PaymentCompletedEvent, PaymentFailedEvent, JsonLogger } from '@food-ordering/common';
import * as crypto from 'crypto';

@Injectable()
export class PaymentService {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    @Inject('KAFKA_CLIENT') private readonly kafkaClient: ClientKafka,
    private readonly logger: JsonLogger,
  ) {
    this.logger.setContext(PaymentService.name);
  }

  async processOrderPayment(orderId: string, userId: string, amount: number): Promise<void> {
    this.logger.log(`Processing payment for Order ${orderId}, User ${userId}, Amount $${amount}`, 'Payment');

    const payment = await this.paymentRepository.createPayment(orderId, userId, amount);

    const isSuccess = amount <= 1000000.00;

    if (isSuccess) {
      const transactionId = `TXN-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
      await this.paymentRepository.updateStatus(payment.id, PaymentStatus.COMPLETED, transactionId);
      this.logger.log(`Payment successful for Order ${orderId}. Txn: ${transactionId}`, 'Payment');

      const completedEvent = new PaymentCompletedEvent(
        payment.id,
        orderId,
        transactionId,
        amount
      );
      this.kafkaClient.emit('PaymentCompleted', JSON.stringify(completedEvent));
      this.logger.log(`Published PaymentCompleted event for Order ${orderId}`, 'Payment');
    } else {
      const reason = 'Insufficient funds / Credit limit of 1,000,000 VND exceeded';
      await this.paymentRepository.updateStatus(payment.id, PaymentStatus.FAILED, undefined, reason);
      this.logger.error(`Payment failed for Order ${orderId}. Reason: ${reason}`, 'Payment');

      const failedEvent = new PaymentFailedEvent(
        orderId,
        amount,
        reason
      );
      this.kafkaClient.emit('PaymentFailed', JSON.stringify(failedEvent));
      this.logger.log(`Published PaymentFailed event for Order ${orderId}`, 'Payment');
    }
  }

  async getPaymentByOrderId(orderId: string) {
    return this.paymentRepository.findByOrderId(orderId);
  }

  async processStripePayment(orderId: string, stripeToken: string, amount: number): Promise<any> {
    this.logger.log(`Processing Stripe payment for Order ${orderId}, Token ${stripeToken}, Amount $${amount}`, 'StripePayment');

    // Find or create payment log
    let payment = await this.paymentRepository.findByOrderId(orderId);
    if (!payment) {
      payment = await this.paymentRepository.createPayment(orderId, 'stripe-user', amount);
    }

    // Mock Stripe validation based on token
    const isDeclined = stripeToken === 'tok_chargeDeclined' || stripeToken === 'tok_chargeDeclinedExpiredCard';
    
    if (!isDeclined) {
      const stripeChargeId = `ch_${crypto.randomBytes(12).toString('hex')}`;
      await this.paymentRepository.updateStatus(payment.id, PaymentStatus.COMPLETED, stripeChargeId);
      this.logger.log(`Stripe payment successful for Order ${orderId}. Stripe Charge: ${stripeChargeId}`, 'StripePayment');

      const completedEvent = new PaymentCompletedEvent(
        payment.id,
        orderId,
        stripeChargeId,
        amount
      );
      this.kafkaClient.emit('PaymentCompleted', JSON.stringify(completedEvent));
      this.logger.log(`Published PaymentCompleted event via Stripe for Order ${orderId}`, 'StripePayment');

      return {
        success: true,
        chargeId: stripeChargeId,
        status: 'succeeded',
        amount,
        billingDetails: {
          brand: 'Visa',
          last4: '4242',
        }
      };
    } else {
      const reason = 'Stripe Card Declined: The card has insufficient funds or is expired.';
      await this.paymentRepository.updateStatus(payment.id, PaymentStatus.FAILED, undefined, reason);
      this.logger.error(`Stripe payment failed for Order ${orderId}. Reason: ${reason}`, 'StripePayment');

      const failedEvent = new PaymentFailedEvent(
        orderId,
        amount,
        reason
      );
      this.kafkaClient.emit('PaymentFailed', JSON.stringify(failedEvent));
      this.logger.log(`Published PaymentFailed event via Stripe for Order ${orderId}`, 'StripePayment');

      return {
        success: false,
        status: 'failed',
        reason,
      };
    }
  }
}

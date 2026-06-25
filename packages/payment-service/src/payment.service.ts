import { Injectable, Inject } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { PaymentRepository } from './repositories/payment.repository';
import { PaymentStatus } from './entities/payment.entity';
import { PaymentCompletedEvent, PaymentFailedEvent, JsonLogger } from '@food-ordering/common';
import * as crypto from 'crypto';
import Stripe from 'stripe';

@Injectable()
export class PaymentService {
  private stripe: Stripe | null = null;

  constructor(
    private readonly paymentRepository: PaymentRepository,
    @Inject('KAFKA_CLIENT') private readonly kafkaClient: ClientKafka,
    private readonly logger: JsonLogger,
  ) {
    this.logger.setContext(PaymentService.name);
    
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey, {
        apiVersion: '2023-10-16' as any,
      });
      this.logger.log('Stripe SDK initialized successfully with STRIPE_SECRET_KEY', 'Init');
    } else {
      this.stripe = null;
      this.logger.warn('STRIPE_SECRET_KEY not found. Falling back to Mock Stripe mode.', 'Init');
    }
  }

  /**
   * Called when a new Order is created.
   * Create a pending payment record, letting the user pay on the UI.
   */
  async processOrderPayment(orderId: string, userId: string, amount: number): Promise<void> {
    this.logger.log(`Creating pending payment record for Order ${orderId}, User ${userId}`, 'Payment');
    await this.paymentRepository.createPayment(orderId, userId, amount);
  }

  async getPaymentByOrderId(orderId: string) {
    return this.paymentRepository.findByOrderId(orderId);
  }

  async getMyPayments(userId: string) {
    return this.paymentRepository.findByUserId(userId);
  }

  async processStripePayment(orderId: string, stripeToken: string, amount: number, userId?: string): Promise<any> {
    this.logger.log(`Processing Stripe payment for Order ${orderId}, Token ${stripeToken}`, 'StripePayment');

    let payment = await this.paymentRepository.findByOrderId(orderId);
    if (!payment) {
      payment = await this.paymentRepository.createPayment(orderId, userId ?? 'unknown', amount);
    }

    if (this.stripe) {
      try {
        this.logger.log(`Executing real Stripe charge for Order ${orderId}`, 'StripePayment');
        const charge = await this.stripe.charges.create({
          amount: Math.round(amount * 100),
          currency: 'usd',
          source: stripeToken,
          description: `FoodOrder payment for Order ${orderId}`,
        });

        await this.paymentRepository.updateStatus(payment.id, PaymentStatus.COMPLETED, charge.id);
        const completedEvent = new PaymentCompletedEvent(payment.id, orderId, charge.id, amount);
        this.kafkaClient.emit('PaymentCompleted', JSON.stringify(completedEvent));
        this.logger.log(`Real Stripe payment succeeded. Charge: ${charge.id}`, 'StripePayment');

        return {
          success: true,
          chargeId: charge.id,
          status: 'succeeded',
          amount,
          billingDetails: {
            brand: charge.payment_method_details?.card?.brand || 'Visa',
            last4: charge.payment_method_details?.card?.last4 || '4242',
          },
        };
      } catch (err: any) {
        const reason = err.message || 'Stripe credit card processing failed.';
        await this.paymentRepository.updateStatus(payment.id, PaymentStatus.FAILED, undefined, reason);
        const failedEvent = new PaymentFailedEvent(orderId, amount, reason);
        this.kafkaClient.emit('PaymentFailed', JSON.stringify(failedEvent));
        this.logger.error(`Real Stripe payment failed: ${reason}`, 'StripePayment');
        return { success: false, status: 'failed', reason };
      }
    }

    // Mock Stripe fallback
    const isDeclined = stripeToken === 'tok_chargeDeclined' || stripeToken === 'tok_chargeDeclinedExpiredCard';
    if (!isDeclined) {
      const stripeChargeId = `ch_mock_${crypto.randomBytes(12).toString('hex')}`;
      await this.paymentRepository.updateStatus(payment.id, PaymentStatus.COMPLETED, stripeChargeId);
      const completedEvent = new PaymentCompletedEvent(payment.id, orderId, stripeChargeId, amount);
      this.kafkaClient.emit('PaymentCompleted', JSON.stringify(completedEvent));
      this.logger.log(`Mock Stripe payment succeeded. Charge: ${stripeChargeId}`, 'StripePayment');
      return {
        success: true,
        chargeId: stripeChargeId,
        status: 'succeeded',
        amount,
        billingDetails: { brand: 'Visa', last4: '4242' },
      };
    } else {
      const reason = 'Stripe Card Declined (Mock): The card has insufficient funds or is expired.';
      await this.paymentRepository.updateStatus(payment.id, PaymentStatus.FAILED, undefined, reason);
      const failedEvent = new PaymentFailedEvent(orderId, amount, reason);
      this.kafkaClient.emit('PaymentFailed', JSON.stringify(failedEvent));
      this.logger.error(`Mock Stripe payment declined for Order ${orderId}`, 'StripePayment');
      return { success: false, status: 'failed', reason };
    }
  }

  /**
   * Process refund when an order is cancelled after payment.
   * Supports both real Stripe charges and mock charges.
   */
  async processRefund(orderId: string): Promise<void> {
    this.logger.log(`Processing refund for Order ${orderId}`, 'Refund');

    const payment = await this.paymentRepository.findByOrderId(orderId);
    if (!payment) {
      this.logger.warn(`No payment found for Order ${orderId}. Skipping refund.`, 'Refund');
      return;
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      this.logger.log(`Payment for Order ${orderId} is ${payment.status} — no refund needed.`, 'Refund');
      return;
    }

    const chargeId = payment.transactionId;
    let refundId: string;

    // Real Stripe charge (ID starts with 'ch_' but NOT 'ch_mock_')
    if (this.stripe && chargeId && !chargeId.startsWith('ch_mock_')) {
      try {
        this.logger.log(`Issuing real Stripe refund for charge ${chargeId}`, 'Refund');
        const refund = await this.stripe.refunds.create({ charge: chargeId });
        refundId = refund.id;
        this.logger.log(`Real Stripe refund succeeded. Refund ID: ${refundId}`, 'Refund');
      } catch (err: any) {
        this.logger.error(`Stripe refund failed for charge ${chargeId}: ${err.message}`, 'Refund');
        return;
      }
    } else {
      // Mock refund
      refundId = `re_mock_${crypto.randomBytes(10).toString('hex')}`;
      this.logger.log(`Mock refund issued: ${refundId} for charge ${chargeId}`, 'Refund');
    }

    await this.paymentRepository.updateRefunded(payment.id, refundId);
    this.logger.log(`Payment ${payment.id} updated to REFUNDED. RefundId: ${refundId}`, 'Refund');
  }

  /**
   * Kafka Consumer: OrderCancelled
   * Triggered when order is cancelled (payment failed OR delivery failed).
   * Only refunds if payment was already COMPLETED.
   */
  async handleOrderCancelled(payload: any): Promise<void> {
    const { orderId, reason } = payload;
    this.logger.log(`Received OrderCancelled for Order ${orderId}. Reason: ${reason}`, 'KafkaConsumer');
    await this.processRefund(orderId);
  }
}


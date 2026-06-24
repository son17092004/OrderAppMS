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
      this.logger.warn('STRIPE_SECRET_KEY not found in environment. Falling back to Mock Stripe mode.', 'Init');
    }
  }

  /**
   * Called when a new Order is created.
   * We only create a pending payment record, letting the user pay on the UI.
   */
  async processOrderPayment(orderId: string, userId: string, amount: number): Promise<void> {
    this.logger.log(`Creating pending payment record for Order ${orderId}, User ${userId}, Amount $${amount}`, 'Payment');

    // Initialize the payment record in PENDING state
    await this.paymentRepository.createPayment(orderId, userId, amount);
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

    // Check if Stripe SDK is configured
    if (this.stripe) {
      try {
        this.logger.log(`Executing real Stripe charge for Order ${orderId}`, 'StripePayment');
        
        // Stripe amount is in cents
        const charge = await this.stripe.charges.create({
          amount: Math.round(amount * 100),
          currency: 'usd',
          source: stripeToken,
          description: `FoodOrder payment for Order ${orderId}`,
        });

        await this.paymentRepository.updateStatus(payment.id, PaymentStatus.COMPLETED, charge.id);
        this.logger.log(`Stripe payment successful for Order ${orderId}. Charge ID: ${charge.id}`, 'StripePayment');

        const completedEvent = new PaymentCompletedEvent(
          payment.id,
          orderId,
          charge.id,
          amount
        );
        this.kafkaClient.emit('PaymentCompleted', JSON.stringify(completedEvent));
        this.logger.log(`Published PaymentCompleted event via real Stripe for Order ${orderId}`, 'StripePayment');

        return {
          success: true,
          chargeId: charge.id,
          status: 'succeeded',
          amount,
          billingDetails: {
            brand: charge.payment_method_details?.card?.brand || 'Visa',
            last4: charge.payment_method_details?.card?.last4 || '4242',
          }
        };
      } catch (err: any) {
        const reason = err.message || 'Stripe credit card processing failed.';
        await this.paymentRepository.updateStatus(payment.id, PaymentStatus.FAILED, undefined, reason);
        this.logger.error(`Stripe payment failed for Order ${orderId}. Reason: ${reason}`, 'StripePayment');

        const failedEvent = new PaymentFailedEvent(
          orderId,
          amount,
          reason
        );
        this.kafkaClient.emit('PaymentFailed', JSON.stringify(failedEvent));
        this.logger.log(`Published PaymentFailed event via real Stripe for Order ${orderId}`, 'StripePayment');

        return {
          success: false,
          status: 'failed',
          reason,
        };
      }
    }

    // FALLBACK: Mock Stripe validation based on token if stripeKey is not present
    this.logger.log(`Executing Mock Stripe validation for Order ${orderId} (Fallback mode)`, 'StripePayment');
    const isDeclined = stripeToken === 'tok_chargeDeclined' || stripeToken === 'tok_chargeDeclinedExpiredCard';
    
    if (!isDeclined) {
      const stripeChargeId = `ch_mock_${crypto.randomBytes(12).toString('hex')}`;
      await this.paymentRepository.updateStatus(payment.id, PaymentStatus.COMPLETED, stripeChargeId);
      this.logger.log(`Stripe payment successful (Mock) for Order ${orderId}. Stripe Charge: ${stripeChargeId}`, 'StripePayment');

      const completedEvent = new PaymentCompletedEvent(
        payment.id,
        orderId,
        stripeChargeId,
        amount
      );
      this.kafkaClient.emit('PaymentCompleted', JSON.stringify(completedEvent));
      this.logger.log(`Published PaymentCompleted event via Mock Stripe for Order ${orderId}`, 'StripePayment');

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
      const reason = 'Stripe Card Declined (Mock): The card has insufficient funds or is expired.';
      await this.paymentRepository.updateStatus(payment.id, PaymentStatus.FAILED, undefined, reason);
      this.logger.error(`Stripe payment failed (Mock) for Order ${orderId}. Reason: ${reason}`, 'StripePayment');

      const failedEvent = new PaymentFailedEvent(
        orderId,
        amount,
        reason
      );
      this.kafkaClient.emit('PaymentFailed', JSON.stringify(failedEvent));
      this.logger.log(`Published PaymentFailed event via Mock Stripe for Order ${orderId}`, 'StripePayment');

      return {
        success: false,
        status: 'failed',
        reason,
      };
    }
  }
}

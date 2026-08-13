import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus } from '@prisma/client';
import Stripe from 'stripe';

import { PaymentConfig } from '../../config/configuration';
import {
  CreatePaymentIntentParams,
  PaymentIntentResult,
  PaymentProvider,
  WebhookEvent,
} from '../interfaces/payment-provider.interface';

@Injectable()
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'STRIPE';
  private readonly logger = new Logger('StripePaymentProvider');
  private readonly stripe: Stripe | null;
  private readonly config: PaymentConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<PaymentConfig>('payment')!;
    this.stripe = this.config.stripeSecretKey ? new Stripe(this.config.stripeSecretKey) : null;
  }

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured: set STRIPE_SECRET_KEY');
    }

    const amountInMinorUnits = Math.round(Number(params.amount) * 100);

    const intent = await this.stripe.paymentIntents.create({
      amount: amountInMinorUnits,
      currency: params.currency.toLowerCase(),
      metadata: { orderId: params.orderId },
    });

    return {
      providerPaymentId: intent.id,
      clientSecret: intent.client_secret ?? undefined,
      status: PaymentStatus.PENDING,
    };
  }

  /** @throws Error if the signature is missing/invalid — callers must reject the request (400). */
  parseWebhook(rawBody: Buffer, signature: string | undefined): WebhookEvent | null {
    if (!this.stripe || !this.config.stripeWebhookSecret) {
      throw new Error('Stripe webhooks are not configured');
    }
    if (!signature) {
      throw new Error('Missing Stripe-Signature header');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.config.stripeWebhookSecret,
      );
    } catch (error) {
      this.logger.warn(`Stripe webhook signature verification failed: ${(error as Error).message}`);
      throw new Error('Invalid webhook signature', { cause: error });
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object;
        return { providerPaymentId: intent.id, status: PaymentStatus.SUCCESS };
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object;
        return { providerPaymentId: intent.id, status: PaymentStatus.FAILED };
      }
      default:
        return null;
    }
  }
}

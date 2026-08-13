import { PaymentStatus } from '@prisma/client';

export interface CreatePaymentIntentParams {
  orderId: string;
  amount: string;
  currency: string;
}

export interface PaymentIntentResult {
  providerPaymentId: string;
  clientSecret?: string;
  status: PaymentStatus;
}

export interface WebhookEvent {
  providerPaymentId: string;
  status: PaymentStatus;
}

export interface PaymentProvider {
  readonly name: string;
  createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult>;
  /**
   * Verifies the webhook signature and returns the normalized event, or null
   * if the event type is recognized but not actionable. Must throw if the
   * signature is missing or invalid.
   */
  parseWebhook(rawBody: Buffer, signature: string | undefined): WebhookEvent | null;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

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
  /** HTTP header (lowercase) the webhook signature arrives on, e.g. 'stripe-signature'. */
  readonly webhookSignatureHeader: string;
  createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult>;
  /**
   * Verifies the webhook signature and returns the normalized event, or null
   * if the event type is recognized but not actionable. Must throw if the
   * signature is missing or invalid.
   */
  parseWebhook(rawBody: Buffer, signature: string | undefined): WebhookEvent | null;
  /**
   * Verifies a client-reported payment completion (e.g. the params Razorpay
   * Checkout's success handler returns) so the order can be confirmed
   * immediately instead of waiting on the async webhook — needed for
   * providers whose webhook can't reach a local/private backend. Providers
   * that only confirm via webhook (Stripe) don't implement this. Must throw
   * if the signature is missing or invalid.
   */
  verifyClientPayment?(params: Record<string, string>): WebhookEvent | null;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

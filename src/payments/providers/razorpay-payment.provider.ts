import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus } from '@prisma/client';
import Razorpay from 'razorpay';
import { validatePaymentVerification } from 'razorpay/dist/utils/razorpay-utils';

import { PaymentConfig } from '../../config/configuration';
import {
  CreatePaymentIntentParams,
  PaymentIntentResult,
  PaymentProvider,
  WebhookEvent,
} from '../interfaces/payment-provider.interface';

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id: string;
      };
    };
  };
}

@Injectable()
export class RazorpayPaymentProvider implements PaymentProvider {
  readonly name = 'RAZORPAY';
  readonly webhookSignatureHeader = 'x-razorpay-signature';
  private readonly logger = new Logger('RazorpayPaymentProvider');
  private readonly client: Razorpay | null;
  private readonly config: PaymentConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<PaymentConfig>('payment')!;
    this.client =
      this.config.razorpayKeyId && this.config.razorpayKeySecret
        ? new Razorpay({
            key_id: this.config.razorpayKeyId,
            key_secret: this.config.razorpayKeySecret,
          })
        : null;
  }

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult> {
    if (!this.client) {
      throw new Error('Razorpay is not configured: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
    }

    // Razorpay amounts are in the currency's smallest unit (e.g. paise for INR).
    const amountInMinorUnits = Math.round(Number(params.amount) * 100);

    const order = await this.client.orders.create({
      amount: amountInMinorUnits,
      currency: params.currency.toUpperCase(),
      receipt: params.orderId,
      notes: { orderId: params.orderId },
    });

    return {
      providerPaymentId: order.id,
      status: PaymentStatus.PENDING,
    };
  }

  /** @throws Error if the signature is missing/invalid — callers must reject the request (400). */
  parseWebhook(rawBody: Buffer, signature: string | undefined): WebhookEvent | null {
    if (!this.config.razorpayWebhookSecret) {
      throw new Error('Razorpay webhooks are not configured: set RAZORPAY_WEBHOOK_SECRET');
    }
    if (!signature) {
      throw new Error('Missing X-Razorpay-Signature header');
    }

    const body = rawBody.toString('utf-8');
    const isValid = Razorpay.validateWebhookSignature(
      body,
      signature,
      this.config.razorpayWebhookSecret,
    );
    if (!isValid) {
      this.logger.warn('Razorpay webhook signature verification failed');
      throw new Error('Invalid webhook signature');
    }

    let event: RazorpayWebhookPayload;
    try {
      event = JSON.parse(body) as RazorpayWebhookPayload;
    } catch (error) {
      throw new Error('Invalid webhook payload', { cause: error });
    }

    switch (event.event) {
      case 'payment.captured': {
        const payment = event.payload.payment?.entity;
        if (!payment) return null;
        // Our Payment record is keyed by the Razorpay *order* id (set at
        // createPaymentIntent time), not the payment id, so match on that.
        return { providerPaymentId: payment.order_id, status: PaymentStatus.SUCCESS };
      }
      case 'payment.failed': {
        const payment = event.payload.payment?.entity;
        if (!payment) return null;
        return { providerPaymentId: payment.order_id, status: PaymentStatus.FAILED };
      }
      default:
        return null;
    }
  }

  /** @throws Error if params are missing/invalid — callers must reject the request (400). */
  verifyClientPayment(params: Record<string, string>): WebhookEvent | null {
    if (!this.config.razorpayKeySecret) {
      throw new Error('Razorpay is not configured: set RAZORPAY_KEY_SECRET');
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = params;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new Error(
        'Missing razorpay_order_id, razorpay_payment_id, or razorpay_signature',
      );
    }

    // Checkout payment verification is signed with the API key_secret (not the
    // separate webhook secret): payload = order_id + "|" + payment_id.
    const isValid = validatePaymentVerification(
      { order_id: razorpay_order_id, payment_id: razorpay_payment_id },
      razorpay_signature,
      this.config.razorpayKeySecret,
    );
    if (!isValid) {
      this.logger.warn('Razorpay payment verification signature mismatch');
      throw new Error('Invalid payment signature');
    }

    return { providerPaymentId: razorpay_order_id, status: PaymentStatus.SUCCESS };
  }
}

import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';

import {
  CreatePaymentIntentParams,
  PaymentIntentResult,
  PaymentProvider,
  WebhookEvent,
} from '../interfaces/payment-provider.interface';

/**
 * Local-dev/testing payment provider: "succeeds" every payment immediately
 * without contacting a real gateway. Swap PAYMENT_PROVIDER=stripe for production.
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'MOCK';
  private readonly logger = new Logger('MockPaymentProvider');

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult> {
    const providerPaymentId = `mock_pi_${randomUUID()}`;
    this.logger.log(
      `[MOCK PAYMENT] Simulating successful payment of ${params.amount} ${params.currency} for order ${params.orderId}`,
    );
    return Promise.resolve({
      providerPaymentId,
      status: PaymentStatus.SUCCESS,
    });
  }

  parseWebhook(rawBody: Buffer): WebhookEvent | null {
    try {
      const payload = JSON.parse(rawBody.toString('utf-8')) as {
        providerPaymentId?: string;
        status?: PaymentStatus;
      };
      if (!payload.providerPaymentId || !payload.status) {
        return null;
      }
      return { providerPaymentId: payload.providerPaymentId, status: payload.status };
    } catch {
      return null;
    }
  }
}

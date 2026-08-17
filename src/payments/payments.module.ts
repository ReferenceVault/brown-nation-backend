import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PaymentConfig } from '../config/configuration';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PAYMENT_PROVIDER } from './interfaces/payment-provider.interface';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { RazorpayPaymentProvider } from './providers/razorpay-payment.provider';
import { StripePaymentProvider } from './providers/stripe-payment.provider';

@Module({
  controllers: [PaymentsController],
  providers: [
    MockPaymentProvider,
    StripePaymentProvider,
    RazorpayPaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (
        configService: ConfigService,
        mock: MockPaymentProvider,
        stripe: StripePaymentProvider,
        razorpay: RazorpayPaymentProvider,
      ) => {
        const paymentConfig = configService.get<PaymentConfig>('payment')!;
        if (paymentConfig.provider === 'stripe') return stripe;
        if (paymentConfig.provider === 'razorpay') return razorpay;
        return mock;
      },
      inject: [ConfigService, MockPaymentProvider, StripePaymentProvider, RazorpayPaymentProvider],
    },
    PaymentsService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}

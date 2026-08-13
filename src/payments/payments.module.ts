import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PaymentConfig } from '../config/configuration';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PAYMENT_PROVIDER } from './interfaces/payment-provider.interface';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { StripePaymentProvider } from './providers/stripe-payment.provider';

@Module({
  controllers: [PaymentsController],
  providers: [
    MockPaymentProvider,
    StripePaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (
        configService: ConfigService,
        mock: MockPaymentProvider,
        stripe: StripePaymentProvider,
      ) => {
        const paymentConfig = configService.get<PaymentConfig>('payment')!;
        return paymentConfig.provider === 'stripe' ? stripe : mock;
      },
      inject: [ConfigService, MockPaymentProvider, StripePaymentProvider],
    },
    PaymentsService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}

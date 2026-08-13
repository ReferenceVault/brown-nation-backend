import {
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Payment, PaymentStatus } from '@prisma/client';

import { ErrorCode } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../database/prisma.service';
import { PAYMENT_PROVIDER, PaymentProvider } from './interfaces/payment-provider.interface';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly prisma: PrismaService,
  ) {}

  async initiatePayment(
    requester: { id: string; role: string },
    orderId: string,
  ): Promise<{ payment: Payment; clientSecret?: string }> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (requester.role !== 'ADMIN' && order.userId !== requester.id) {
      throw new ForbiddenException('You may only pay for your own orders');
    }
    if (order.paymentStatus === PaymentStatus.SUCCESS) {
      throw new AppException(
        ErrorCode.PAYMENT_FAILED,
        'This order has already been paid',
        HttpStatus.CONFLICT,
      );
    }

    const intent = await this.provider.createPaymentIntent({
      orderId: order.id,
      amount: order.totalAmount.toString(),
      currency: order.currency,
    });

    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: this.provider.name as Payment['provider'],
        providerPaymentId: intent.providerPaymentId,
        amount: order.totalAmount,
        currency: order.currency,
        status: intent.status,
      },
    });

    if (intent.status === PaymentStatus.SUCCESS) {
      await this.markOrderPaid(order.id);
    }

    return { payment, clientSecret: intent.clientSecret };
  }

  async handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<void> {
    const event = this.provider.parseWebhook(rawBody, signature);
    if (!event) {
      return;
    }

    const payment = await this.prisma.payment.findFirst({
      where: { providerPaymentId: event.providerPaymentId },
    });

    if (!payment) {
      this.logger.warn(`Webhook for unknown payment: ${event.providerPaymentId}`);
      return;
    }

    await this.prisma.payment.update({ where: { id: payment.id }, data: { status: event.status } });

    if (event.status === PaymentStatus.SUCCESS) {
      await this.markOrderPaid(payment.orderId);
    } else if (event.status === PaymentStatus.FAILED) {
      await this.prisma.order.update({
        where: { id: payment.orderId },
        data: { paymentStatus: PaymentStatus.FAILED },
      });
    }
  }

  private async markOrderPaid(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: PaymentStatus.SUCCESS,
        ...(order.status === OrderStatus.PENDING ? { status: OrderStatus.CONFIRMED } : {}),
      },
    });

    if (order.status === OrderStatus.PENDING) {
      await this.prisma.orderStatusHistory.create({
        data: { orderId, status: OrderStatus.CONFIRMED, note: 'Payment received' },
      });
    }
  }
}

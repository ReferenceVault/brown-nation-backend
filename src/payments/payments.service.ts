import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Order, OrderStatus, Payment, PaymentStatus, Prisma } from '@prisma/client';

import { ErrorCode } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import {
  PAYMENT_PROVIDER,
  PaymentProvider,
  WebhookEvent,
} from './interfaces/payment-provider.interface';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /** HTTP header the active provider's webhook signature arrives on. */
  get webhookSignatureHeader(): string {
    return this.provider.webhookSignatureHeader;
  }

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
    await this.applyPaymentEvent(event);
  }

  /**
   * Confirms payment immediately from client-reported checkout success params
   * (e.g. Razorpay Checkout's handler callback), rather than waiting on the
   * async webhook — necessary in local/private deployments the provider's
   * webhook can't reach. Falls back to the webhook as the durable source of
   * truth in production; this is a fast-path, not a replacement.
   */
  async verifyPayment(
    requester: { id: string; role: string },
    orderId: string,
    params: Record<string, string>,
  ): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (requester.role !== 'ADMIN' && order.userId !== requester.id) {
      throw new ForbiddenException('You may only verify payment for your own orders');
    }

    if (!this.provider.verifyClientPayment) {
      throw new BadRequestException(
        `${this.provider.name} does not support client-side payment verification`,
      );
    }

    let event: WebhookEvent | null;
    try {
      event = this.provider.verifyClientPayment(params);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    if (event) {
      await this.applyPaymentEvent(event);
    }

    return this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  }

  private async applyPaymentEvent(event: WebhookEvent): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: { providerPaymentId: event.providerPaymentId },
    });

    if (!payment) {
      this.logger.warn(`Payment event for unknown payment: ${event.providerPaymentId}`);
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
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true, user: { select: { email: true } } },
    });

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

    await this.sendOrderPaidEmails(order);
  }

  /**
   * Best-effort: the payment is already confirmed and recorded, so a
   * transient email provider issue shouldn't affect the payment flow —
   * just log it and move on.
   */
  private async sendOrderPaidEmails(
    order: Prisma.OrderGetPayload<{
      include: { items: true; user: { select: { email: true } } };
    }>,
  ): Promise<void> {
    const shippingAddress = order.shippingAddress as { fullName?: string } | null;
    const customerName = shippingAddress?.fullName ?? 'there';
    const customerEmail = order.user?.email;

    if (!customerEmail) {
      this.logger.warn(`Order ${order.id} has no associated user email; skipping order emails`);
      return;
    }

    const emailDetails = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName,
      customerEmail,
      totalAmount: order.totalAmount.toString(),
      currency: order.currency,
      items: order.items.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        totalPrice: item.totalPrice.toString(),
      })),
    };

    try {
      await this.emailService.sendOrderConfirmationEmail(emailDetails);
      await this.emailService.sendOrderNotificationEmail(emailDetails);
    } catch (error) {
      this.logger.error(`Failed to send order-paid emails for ${order.id}`, error as Error);
    }
  }
}

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentStatus } from '@prisma/client';

import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../database/prisma.service';
import { PaymentProvider } from './interfaces/payment-provider.interface';
import { PaymentsService } from './payments.service';

function buildOrder(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'order-1',
    userId: 'user-1',
    status: OrderStatus.PENDING,
    paymentStatus: PaymentStatus.PENDING,
    totalAmount: { toString: () => '469.35' },
    currency: 'INR',
    ...overrides,
  };
}

describe('PaymentsService', () => {
  let provider: jest.Mocked<PaymentProvider>;
  let prisma: {
    order: Record<string, jest.Mock>;
    payment: Record<string, jest.Mock>;
    orderStatusHistory: Record<string, jest.Mock>;
  };
  let service: PaymentsService;

  beforeEach(() => {
    provider = {
      name: 'MOCK',
      createPaymentIntent: jest.fn(),
      parseWebhook: jest.fn(),
    };
    prisma = {
      order: { findUnique: jest.fn(), update: jest.fn(), findUniqueOrThrow: jest.fn() },
      payment: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      orderStatusHistory: { create: jest.fn() },
    };
    service = new PaymentsService(provider, prisma as unknown as PrismaService);
  });

  describe('initiatePayment', () => {
    it('throws when the order does not exist', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.initiatePayment({ id: 'user-1', role: 'CUSTOMER' }, 'order-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when a non-owner, non-admin requester tries to pay', async () => {
      prisma.order.findUnique.mockResolvedValue(buildOrder({ userId: 'someone-else' }));

      await expect(
        service.initiatePayment({ id: 'user-1', role: 'CUSTOMER' }, 'order-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws when the order has already been paid', async () => {
      prisma.order.findUnique.mockResolvedValue(
        buildOrder({ paymentStatus: PaymentStatus.SUCCESS }),
      );

      await expect(
        service.initiatePayment({ id: 'user-1', role: 'CUSTOMER' }, 'order-1'),
      ).rejects.toBeInstanceOf(AppException);
    });

    it('creates a payment record and marks the order paid on immediate success', async () => {
      prisma.order.findUnique.mockResolvedValue(buildOrder());
      provider.createPaymentIntent.mockResolvedValue({
        providerPaymentId: 'mock_pi_1',
        status: PaymentStatus.SUCCESS,
      });
      prisma.payment.create.mockResolvedValue({ id: 'payment-1', status: PaymentStatus.SUCCESS });
      prisma.order.findUniqueOrThrow.mockResolvedValue(buildOrder());
      prisma.order.update.mockResolvedValue({});

      const result = await service.initiatePayment({ id: 'user-1', role: 'CUSTOMER' }, 'order-1');

      expect(result.payment.status).toBe(PaymentStatus.SUCCESS);
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-1' },
          data: expect.objectContaining({ paymentStatus: PaymentStatus.SUCCESS }),
        }),
      );
    });
  });

  describe('handleWebhook', () => {
    it('ignores events the provider does not recognize', async () => {
      provider.parseWebhook.mockReturnValue(null);

      await service.handleWebhook(Buffer.from('{}'), undefined);

      expect(prisma.payment.findFirst).not.toHaveBeenCalled();
    });

    it('ignores webhooks for a payment id it does not know about', async () => {
      provider.parseWebhook.mockReturnValue({
        providerPaymentId: 'unknown_pi',
        status: PaymentStatus.SUCCESS,
      });
      prisma.payment.findFirst.mockResolvedValue(null);

      await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('marks the order paid when the webhook reports success', async () => {
      provider.parseWebhook.mockReturnValue({
        providerPaymentId: 'mock_pi_1',
        status: PaymentStatus.SUCCESS,
      });
      prisma.payment.findFirst.mockResolvedValue({ id: 'payment-1', orderId: 'order-1' });
      prisma.payment.update.mockResolvedValue({});
      prisma.order.findUniqueOrThrow.mockResolvedValue(buildOrder());
      prisma.order.update.mockResolvedValue({});

      await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ paymentStatus: PaymentStatus.SUCCESS }),
        }),
      );
    });
  });
});

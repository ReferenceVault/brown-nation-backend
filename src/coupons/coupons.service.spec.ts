import { CouponDiscountType, CouponStatus, Prisma } from '@prisma/client';

import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../database/prisma.service';
import { CouponItemInput, CouponsService } from './coupons.service';

function buildCoupon(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'coupon-1',
    code: 'SWEET15',
    discountType: CouponDiscountType.PERCENTAGE,
    discountValue: new Prisma.Decimal(15),
    minOrderAmount: null,
    maxDiscountAmount: null,
    startsAt: null,
    expiresAt: null,
    usageLimit: null,
    perCustomerLimit: null,
    status: CouponStatus.ACTIVE,
    applicableCategoryIds: [] as string[],
    applicableProductIds: [] as string[],
    ...overrides,
  };
}

function buildItems(overrides: Partial<CouponItemInput>[] = []): CouponItemInput[] {
  if (overrides.length > 0) {
    return overrides.map((o, i) => ({
      productId: `product-${i + 1}`,
      categoryId: `category-${i + 1}`,
      quantity: 1,
      unitPrice: new Prisma.Decimal(100),
      ...o,
    }));
  }
  return [
    {
      productId: 'product-1',
      categoryId: 'category-1',
      quantity: 2,
      unitPrice: new Prisma.Decimal(500),
    },
  ];
}

describe('CouponsService', () => {
  let prisma: {
    coupon: Record<string, jest.Mock>;
    couponRedemption: Record<string, jest.Mock>;
  };
  let service: CouponsService;

  beforeEach(() => {
    prisma = {
      coupon: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      couponRedemption: { count: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
    };
    service = new CouponsService(prisma as unknown as PrismaService);
  });

  describe('validateForItems', () => {
    it('rejects an unknown code', async () => {
      prisma.coupon.findFirst.mockResolvedValue(null);

      await expect(service.validateForItems('NOPE', 'user-1', buildItems())).rejects.toBeInstanceOf(
        AppException,
      );
    });

    it('rejects an inactive coupon', async () => {
      prisma.coupon.findFirst.mockResolvedValue(buildCoupon({ status: CouponStatus.INACTIVE }));

      await expect(
        service.validateForItems('SWEET15', 'user-1', buildItems()),
      ).rejects.toBeInstanceOf(AppException);
    });

    it('rejects a coupon that has not started yet', async () => {
      const future = new Date(Date.now() + 86_400_000);
      prisma.coupon.findFirst.mockResolvedValue(buildCoupon({ startsAt: future }));

      await expect(
        service.validateForItems('SWEET15', 'user-1', buildItems()),
      ).rejects.toBeInstanceOf(AppException);
    });

    it('rejects an expired coupon', async () => {
      const past = new Date(Date.now() - 86_400_000);
      prisma.coupon.findFirst.mockResolvedValue(buildCoupon({ expiresAt: past }));

      await expect(
        service.validateForItems('SWEET15', 'user-1', buildItems()),
      ).rejects.toBeInstanceOf(AppException);
    });

    it('rejects when the cart subtotal is below the minimum order amount', async () => {
      prisma.coupon.findFirst.mockResolvedValue(
        buildCoupon({ minOrderAmount: new Prisma.Decimal(999) }),
      );
      prisma.couponRedemption.count.mockResolvedValue(0);

      await expect(
        service.validateForItems(
          'SWEET15',
          'user-1',
          buildItems([{ quantity: 1, unitPrice: new Prisma.Decimal(500) }]),
        ),
      ).rejects.toBeInstanceOf(AppException);
    });

    it('rejects once the total usage limit is reached', async () => {
      prisma.coupon.findFirst.mockResolvedValue(buildCoupon({ usageLimit: 1 }));
      prisma.couponRedemption.count.mockResolvedValue(1);

      await expect(
        service.validateForItems('SWEET15', 'user-1', buildItems()),
      ).rejects.toBeInstanceOf(AppException);
    });

    it('rejects once the per-customer limit is reached', async () => {
      prisma.coupon.findFirst.mockResolvedValue(buildCoupon({ perCustomerLimit: 1 }));
      prisma.couponRedemption.count.mockResolvedValue(1);

      await expect(
        service.validateForItems('SWEET15', 'user-1', buildItems()),
      ).rejects.toBeInstanceOf(AppException);
    });

    it('rejects when no cart item matches the coupon scope', async () => {
      prisma.coupon.findFirst.mockResolvedValue(
        buildCoupon({ applicableCategoryIds: ['some-other-category'] }),
      );

      await expect(
        service.validateForItems('SWEET15', 'user-1', buildItems()),
      ).rejects.toBeInstanceOf(AppException);
    });

    it('computes a percentage discount over the eligible subtotal', async () => {
      prisma.coupon.findFirst.mockResolvedValue(
        buildCoupon({ discountValue: new Prisma.Decimal(15) }),
      );
      prisma.couponRedemption.count.mockResolvedValue(0);

      const result = await service.validateForItems(
        'sweet15',
        'user-1',
        buildItems([{ quantity: 1, unitPrice: new Prisma.Decimal(1000) }]),
      );

      expect(result.discountAmount.toString()).toBe('150');
    });

    it('caps a percentage discount at maxDiscountAmount', async () => {
      prisma.coupon.findFirst.mockResolvedValue(
        buildCoupon({
          discountValue: new Prisma.Decimal(50),
          maxDiscountAmount: new Prisma.Decimal(100),
        }),
      );
      prisma.couponRedemption.count.mockResolvedValue(0);

      const result = await service.validateForItems(
        'SWEET15',
        'user-1',
        buildItems([{ quantity: 1, unitPrice: new Prisma.Decimal(1000) }]),
      );

      expect(result.discountAmount.toString()).toBe('100');
    });

    it('clamps a fixed-amount discount to the eligible subtotal', async () => {
      prisma.coupon.findFirst.mockResolvedValue(
        buildCoupon({
          discountType: CouponDiscountType.FIXED_AMOUNT,
          discountValue: new Prisma.Decimal(100),
        }),
      );
      prisma.couponRedemption.count.mockResolvedValue(0);

      const result = await service.validateForItems(
        'SWEET15',
        'user-1',
        buildItems([{ quantity: 1, unitPrice: new Prisma.Decimal(60) }]),
      );

      expect(result.discountAmount.toString()).toBe('60');
    });

    it('only discounts eligible items when the coupon is scoped', async () => {
      prisma.coupon.findFirst.mockResolvedValue(
        buildCoupon({
          discountType: CouponDiscountType.PERCENTAGE,
          discountValue: new Prisma.Decimal(10),
          applicableProductIds: ['product-1'],
        }),
      );
      prisma.couponRedemption.count.mockResolvedValue(0);

      const result = await service.validateForItems('SWEET15', 'user-1', [
        {
          productId: 'product-1',
          categoryId: 'category-1',
          quantity: 1,
          unitPrice: new Prisma.Decimal(1000),
        },
        {
          productId: 'product-2',
          categoryId: 'category-2',
          quantity: 1,
          unitPrice: new Prisma.Decimal(1000),
        },
      ]);

      expect(result.eligibleSubtotal.toString()).toBe('1000');
      expect(result.subtotal.toString()).toBe('2000');
      expect(result.discountAmount.toString()).toBe('100');
    });

    it('matches regardless of case and hidden/invisible whitespace in the typed code', async () => {
      prisma.coupon.findFirst.mockResolvedValue(buildCoupon({ code: 'GANESH' }));
      prisma.couponRedemption.count.mockResolvedValue(0);

      const typedWithInvisibleChar = `ga\u200Bnesh`; // zero-width space mid-string
      const result = await service.validateForItems(typedWithInvisibleChar, 'user-1', buildItems());

      expect(prisma.coupon.findFirst).toHaveBeenCalledWith({
        where: { code: { equals: 'GANESH', mode: 'insensitive' } },
      });
      expect(result.coupon.code).toBe('GANESH');
    });
  });
});

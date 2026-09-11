import { HttpStatus, Injectable } from '@nestjs/common';
import { Coupon, CouponStatus, Prisma } from '@prisma/client';

import { ErrorCode } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../database/prisma.service';
import { CouponQueryDto } from './dto/coupon-query.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

type PrismaClientOrTx = PrismaService | Prisma.TransactionClient;

// Zero-width space, zero-width non-joiner/joiner, and BOM/zero-width
// no-break space — none of these are stripped by String.prototype.trim(),
// but mobile keyboards and copy-paste can silently insert them, making an
// apparently-identical coupon code fail to match on lookup.
const INVISIBLE_CHARS = /(?:\u200B|\u200C|\u200D|\uFEFF|\u00A0)/g;

/**
 * Normalizes a coupon code for storage and lookup: strips invisible/hidden
 * characters, collapses all whitespace, and uppercases. Applied identically
 * on write (admin create/update) and read (customer validate, order
 * creation) so the two can never drift apart.
 */
function normalizeCouponCode(code: string): string {
  return code.replace(INVISIBLE_CHARS, '').replace(/\s+/g, '').toUpperCase();
}

export interface CouponItemInput {
  productId: string;
  categoryId: string;
  quantity: number;
  unitPrice: Prisma.Decimal | number;
}

export interface CouponValidationResult {
  coupon: Coupon;
  subtotal: Prisma.Decimal;
  eligibleSubtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
}

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCouponDto): Promise<Coupon> {
    try {
      return await this.prisma.coupon.create({
        data: {
          ...this.toWriteData(dto),
          code: normalizeCouponCode(dto.code),
        } as Prisma.CouponUncheckedCreateInput,
      });
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async findAll(query: CouponQueryDto): Promise<{ items: Coupon[]; total: number }> {
    const where: Prisma.CouponWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { code: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.coupon.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(id: string): Promise<Coupon> {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new AppException(ErrorCode.COUPON_NOT_FOUND, 'Coupon not found', HttpStatus.NOT_FOUND);
    }
    return coupon;
  }

  async update(id: string, dto: UpdateCouponDto): Promise<Coupon> {
    await this.findOne(id);
    try {
      return await this.prisma.coupon.update({
        where: { id },
        data: this.toWriteData(dto),
      });
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.coupon.delete({ where: { id } });
  }

  /**
   * The single source of truth for "is this coupon usable against this cart,
   * and what does it discount". Called both for the customer-facing preview
   * (against `this.prisma`) and from inside OrdersService's order-creation
   * transaction (passing `tx`), so the check-then-use of usage limits is
   * race-free at order time.
   */
  async validateForItems(
    code: string,
    userId: string | undefined,
    items: CouponItemInput[],
    client: PrismaClientOrTx = this.prisma,
  ): Promise<CouponValidationResult> {
    // findFirst + case-insensitive equals (rather than findUnique on the
    // exact column value) so a coupon created any other way than through
    // this service — a direct DB insert, a future admin import script — is
    // still matched even if its stored casing differs.
    const coupon = await client.coupon.findFirst({
      where: { code: { equals: normalizeCouponCode(code), mode: 'insensitive' } },
    });
    if (!coupon) {
      throw new AppException(
        ErrorCode.COUPON_NOT_FOUND,
        'This coupon code does not exist',
        HttpStatus.NOT_FOUND,
      );
    }

    if (coupon.status !== CouponStatus.ACTIVE) {
      throw new AppException(
        ErrorCode.COUPON_INACTIVE,
        'This coupon is no longer active',
        HttpStatus.BAD_REQUEST,
      );
    }

    const now = new Date();
    if (coupon.startsAt && now < coupon.startsAt) {
      throw new AppException(
        ErrorCode.COUPON_NOT_STARTED,
        'This coupon is not active yet',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (coupon.expiresAt && now > coupon.expiresAt) {
      throw new AppException(
        ErrorCode.COUPON_EXPIRED,
        'This coupon has expired',
        HttpStatus.BAD_REQUEST,
      );
    }

    const scoped =
      coupon.applicableCategoryIds.length > 0 || coupon.applicableProductIds.length > 0;
    const isEligible = (item: CouponItemInput) =>
      !scoped ||
      coupon.applicableProductIds.includes(item.productId) ||
      coupon.applicableCategoryIds.includes(item.categoryId);

    const subtotal = items.reduce(
      (sum, item) => sum.plus(new Prisma.Decimal(item.unitPrice).times(item.quantity)),
      new Prisma.Decimal(0),
    );
    const eligibleSubtotal = items
      .filter(isEligible)
      .reduce(
        (sum, item) => sum.plus(new Prisma.Decimal(item.unitPrice).times(item.quantity)),
        new Prisma.Decimal(0),
      );

    if (eligibleSubtotal.lte(0)) {
      throw new AppException(
        ErrorCode.COUPON_NOT_APPLICABLE,
        'This coupon does not apply to any items in your cart',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (coupon.minOrderAmount && subtotal.lt(coupon.minOrderAmount)) {
      throw new AppException(
        ErrorCode.COUPON_MIN_ORDER_NOT_MET,
        `Add ${coupon.minOrderAmount.minus(subtotal).toFixed(2)} more to use this coupon`,
        HttpStatus.BAD_REQUEST,
        {
          minOrderAmount: coupon.minOrderAmount.toString(),
          shortfall: coupon.minOrderAmount.minus(subtotal).toString(),
        },
      );
    }

    if (coupon.usageLimit !== null) {
      const usageCount = await client.couponRedemption.count({ where: { couponId: coupon.id } });
      if (usageCount >= coupon.usageLimit) {
        throw new AppException(
          ErrorCode.COUPON_USAGE_LIMIT_REACHED,
          'This coupon has reached its usage limit',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    if (userId && coupon.perCustomerLimit !== null) {
      const customerUsageCount = await client.couponRedemption.count({
        where: { couponId: coupon.id, userId },
      });
      if (customerUsageCount >= coupon.perCustomerLimit) {
        throw new AppException(
          ErrorCode.COUPON_CUSTOMER_LIMIT_REACHED,
          "You've already used this coupon the maximum number of times",
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    let discountAmount: Prisma.Decimal;
    if (coupon.discountType === 'PERCENTAGE') {
      discountAmount = eligibleSubtotal.times(coupon.discountValue).dividedBy(100);
      if (coupon.maxDiscountAmount && discountAmount.gt(coupon.maxDiscountAmount)) {
        discountAmount = coupon.maxDiscountAmount;
      }
    } else {
      discountAmount = Prisma.Decimal.min(coupon.discountValue, eligibleSubtotal);
    }
    discountAmount = discountAmount.toDecimalPlaces(2);

    return { coupon, subtotal, eligibleSubtotal, discountAmount };
  }

  async recordRedemption(
    tx: Prisma.TransactionClient,
    couponId: string,
    userId: string | undefined,
    orderId: string,
    discountAmount: Prisma.Decimal,
  ): Promise<void> {
    await tx.couponRedemption.create({
      data: { couponId, userId, orderId, discountAmount },
    });
  }

  async releaseRedemption(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
    await tx.couponRedemption.deleteMany({ where: { orderId } });
  }

  private toWriteData(dto: CreateCouponDto | UpdateCouponDto): Prisma.CouponUncheckedUpdateInput {
    return {
      ...(dto.code !== undefined ? { code: normalizeCouponCode(dto.code) } : {}),
      ...(dto.discountType !== undefined ? { discountType: dto.discountType } : {}),
      ...(dto.discountValue !== undefined ? { discountValue: dto.discountValue } : {}),
      ...(dto.minOrderAmount !== undefined ? { minOrderAmount: dto.minOrderAmount } : {}),
      ...(dto.maxDiscountAmount !== undefined ? { maxDiscountAmount: dto.maxDiscountAmount } : {}),
      ...(dto.startsAt !== undefined
        ? { startsAt: dto.startsAt ? new Date(dto.startsAt) : null }
        : {}),
      ...(dto.expiresAt !== undefined
        ? { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }
        : {}),
      ...(dto.usageLimit !== undefined ? { usageLimit: dto.usageLimit } : {}),
      ...(dto.perCustomerLimit !== undefined ? { perCustomerLimit: dto.perCustomerLimit } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.applicableCategoryIds !== undefined
        ? { applicableCategoryIds: dto.applicableCategoryIds }
        : {}),
      ...(dto.applicableProductIds !== undefined
        ? { applicableProductIds: dto.applicableProductIds }
        : {}),
    };
  }

  private mapWriteError(error: unknown): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new AppException(
        ErrorCode.DUPLICATE_COUPON_CODE,
        'A coupon with this code already exists',
        HttpStatus.CONFLICT,
      );
    }
    return error;
  }
}

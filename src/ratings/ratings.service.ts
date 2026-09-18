import { HttpStatus, Injectable } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';

import { ErrorCode } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async rate(userId: string, productId: string, rating: number) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new AppException(
        ErrorCode.PRODUCT_NOT_FOUND,
        'Product not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const hasPurchased = await this.hasPurchased(userId, productId);
    if (!hasPurchased) {
      throw new AppException(
        ErrorCode.RATING_NOT_ALLOWED,
        'You can only rate products you have purchased',
        HttpStatus.FORBIDDEN,
      );
    }

    await this.prisma.productRating.upsert({
      where: { productId_userId: { productId, userId } },
      create: { productId, userId, rating },
      update: { rating },
    });

    await this.recomputeAggregate(productId);

    return { rating };
  }

  async getMine(userId: string, productId: string) {
    const [existing, canRate] = await Promise.all([
      this.prisma.productRating.findUnique({ where: { productId_userId: { productId, userId } } }),
      this.hasPurchased(userId, productId),
    ]);

    return { myRating: existing?.rating ?? null, canRate };
  }

  // A PENDING/unpaid order (e.g. checkout started but never paid) doesn't count —
  // only a successfully paid order is a "verified purchase".
  private hasPurchased(userId: string, productId: string): Promise<boolean> {
    return this.prisma.orderItem
      .findFirst({
        where: { productId, order: { userId, paymentStatus: PaymentStatus.SUCCESS } },
      })
      .then(Boolean);
  }

  private async recomputeAggregate(productId: string): Promise<void> {
    const aggregate = await this.prisma.productRating.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        averageRating: aggregate._avg.rating ?? 0,
        ratingCount: aggregate._count.rating,
      },
    });
  }
}

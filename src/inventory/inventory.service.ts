import { HttpStatus, Injectable } from '@nestjs/common';
import { InventoryChangeReason, Prisma } from '@prisma/client';

import { ErrorCode } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../database/prisma.service';

type PrismaTransactionClient = Prisma.TransactionClient;

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Atomically decrements stock for a single product, guarding against
   * overselling under concurrent requests. Must run inside the same
   * transaction as the order/order-item writes it belongs to.
   */
  async reserveStock(
    tx: PrismaTransactionClient,
    productId: string,
    quantity: number,
    reason: InventoryChangeReason,
    referenceId?: string,
  ): Promise<void> {
    // Single atomic UPDATE ... WHERE stockQuantity >= quantity: Postgres
    // guarantees this row-level check-and-update can't race with a
    // concurrent decrement, so we never oversell without needing SELECT FOR UPDATE.
    const result = await tx.product.updateMany({
      where: { id: productId, stockQuantity: { gte: quantity } },
      data: { stockQuantity: { decrement: quantity } },
    });

    if (result.count === 0) {
      throw new AppException(
        ErrorCode.INSUFFICIENT_STOCK,
        'Insufficient stock for one or more products',
        HttpStatus.CONFLICT,
      );
    }

    await tx.inventoryLog.create({
      data: { productId, change: -quantity, reason, referenceId },
    });
  }

  async releaseStock(
    tx: PrismaTransactionClient,
    productId: string,
    quantity: number,
    reason: InventoryChangeReason,
    referenceId?: string,
  ): Promise<void> {
    await tx.product.update({
      where: { id: productId },
      data: { stockQuantity: { increment: quantity } },
    });

    await tx.inventoryLog.create({
      data: { productId, change: quantity, reason, referenceId },
    });
  }

  async restock(productId: string, quantity: number): Promise<void> {
    if (quantity <= 0) {
      throw new AppException(
        ErrorCode.BAD_REQUEST,
        'Restock quantity must be positive',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await this.releaseStock(tx, productId, quantity, InventoryChangeReason.RESTOCK);
    });
  }
}

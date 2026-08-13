import { InventoryChangeReason } from '@prisma/client';

import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../database/prisma.service';
import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  let service: InventoryService;
  let tx: {
    product: { updateMany: jest.Mock; update: jest.Mock };
    inventoryLog: { create: jest.Mock };
  };

  beforeEach(() => {
    service = new InventoryService({} as PrismaService);
    tx = {
      product: { updateMany: jest.fn(), update: jest.fn() },
      inventoryLog: { create: jest.fn() },
    };
  });

  describe('reserveStock', () => {
    it('decrements stock and logs the change when enough stock is available', async () => {
      tx.product.updateMany.mockResolvedValue({ count: 1 });
      tx.inventoryLog.create.mockResolvedValue({});

      await service.reserveStock(
        tx as never,
        'product-1',
        5,
        InventoryChangeReason.ORDER_PLACED,
        'order-1',
      );

      expect(tx.product.updateMany).toHaveBeenCalledWith({
        where: { id: 'product-1', stockQuantity: { gte: 5 } },
        data: { stockQuantity: { decrement: 5 } },
      });
      expect(tx.inventoryLog.create).toHaveBeenCalledWith({
        data: {
          productId: 'product-1',
          change: -5,
          reason: 'ORDER_PLACED',
          referenceId: 'order-1',
        },
      });
    });

    it('throws INSUFFICIENT_STOCK and does not log when the guarded update matches no rows', async () => {
      tx.product.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.reserveStock(tx as never, 'product-1', 999, InventoryChangeReason.ORDER_PLACED),
      ).rejects.toBeInstanceOf(AppException);

      expect(tx.inventoryLog.create).not.toHaveBeenCalled();
    });
  });

  describe('releaseStock', () => {
    it('increments stock and logs the change', async () => {
      tx.product.update.mockResolvedValue({});
      tx.inventoryLog.create.mockResolvedValue({});

      await service.releaseStock(
        tx as never,
        'product-1',
        2,
        InventoryChangeReason.ORDER_CANCELLED,
        'order-1',
      );

      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: 'product-1' },
        data: { stockQuantity: { increment: 2 } },
      });
      expect(tx.inventoryLog.create).toHaveBeenCalledWith({
        data: {
          productId: 'product-1',
          change: 2,
          reason: 'ORDER_CANCELLED',
          referenceId: 'order-1',
        },
      });
    });
  });

  describe('restock', () => {
    it('rejects a non-positive quantity before touching the database', async () => {
      await expect(service.restock('product-1', 0)).rejects.toBeInstanceOf(AppException);
    });
  });
});

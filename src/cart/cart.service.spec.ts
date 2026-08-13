import { Prisma, ProductStatus } from '@prisma/client';

import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../database/prisma.service';
import { CartService } from './cart.service';

function buildProduct(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'product-1',
    name: 'Assam Gold',
    slug: 'assam-gold',
    images: ['img.jpg'],
    price: new Prisma.Decimal(100),
    stockQuantity: 10,
    status: ProductStatus.ACTIVE,
    ...overrides,
  };
}

describe('CartService', () => {
  let prisma: {
    cart: Record<string, jest.Mock>;
    cartItem: Record<string, jest.Mock>;
    product: Record<string, jest.Mock>;
  };
  let service: CartService;

  beforeEach(() => {
    prisma = {
      cart: { findUnique: jest.fn(), create: jest.fn() },
      cartItem: {
        update: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        findUnique: jest.fn(),
      },
      product: { findUnique: jest.fn() },
    };
    service = new CartService(prisma as unknown as PrismaService);
  });

  describe('addItem', () => {
    it('rejects an unknown product', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.addItem('user-1', 'product-1', 1)).rejects.toBeInstanceOf(AppException);
    });

    it('rejects a product that is not ACTIVE', async () => {
      prisma.product.findUnique.mockResolvedValue(buildProduct({ status: ProductStatus.DRAFT }));

      await expect(service.addItem('user-1', 'product-1', 1)).rejects.toBeInstanceOf(AppException);
    });

    it('rejects a quantity above available stock', async () => {
      prisma.product.findUnique.mockResolvedValue(buildProduct({ stockQuantity: 2 }));
      prisma.cart.findUnique.mockResolvedValue({ id: 'cart-1', userId: 'user-1', items: [] });

      await expect(service.addItem('user-1', 'product-1', 5)).rejects.toBeInstanceOf(AppException);
      expect(prisma.cartItem.create).not.toHaveBeenCalled();
    });

    it('accounts for an existing quantity already in the cart when checking stock', async () => {
      prisma.product.findUnique.mockResolvedValue(buildProduct({ stockQuantity: 5 }));
      prisma.cart.findUnique.mockResolvedValueOnce({
        id: 'cart-1',
        userId: 'user-1',
        items: [{ id: 'item-1', productId: 'product-1', quantity: 4 }],
      });

      // Requesting 2 more on top of 4 already in cart exceeds the 5 in stock.
      await expect(service.addItem('user-1', 'product-1', 2)).rejects.toBeInstanceOf(AppException);
    });

    it('creates a new cart item when stock allows it', async () => {
      prisma.product.findUnique.mockResolvedValue(buildProduct({ stockQuantity: 10 }));
      prisma.cart.findUnique.mockResolvedValueOnce({ id: 'cart-1', userId: 'user-1', items: [] });
      prisma.cartItem.create.mockResolvedValue({});
      prisma.cart.findUnique.mockResolvedValueOnce({
        id: 'cart-1',
        userId: 'user-1',
        items: [{ id: 'item-1', productId: 'product-1', quantity: 3, product: buildProduct() }],
      });

      const result = await service.addItem('user-1', 'product-1', 3);

      expect(prisma.cartItem.create).toHaveBeenCalledWith({
        data: { cartId: 'cart-1', productId: 'product-1', quantity: 3 },
      });
      expect(result.totalItems).toBe(3);
    });
  });

  describe('removeItem', () => {
    it('rejects removing an item that belongs to a different user', async () => {
      prisma.cartItem.findUnique.mockResolvedValue({
        id: 'item-1',
        cart: { userId: 'someone-else' },
      });

      await expect(service.removeItem('user-1', 'item-1')).rejects.toBeInstanceOf(AppException);
      expect(prisma.cartItem.delete).not.toHaveBeenCalled();
    });
  });
});

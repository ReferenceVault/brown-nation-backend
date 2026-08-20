import { Prisma, ProductStatus } from '@prisma/client';

import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../database/prisma.service';
import { ProductsService } from './products.service';

function prismaKnownError(code: string, target: string[]) {
  return Object.assign(Object.create(Prisma.PrismaClientKnownRequestError.prototype), {
    code,
    meta: { target },
    message: 'unique constraint failed',
  }) as Prisma.PrismaClientKnownRequestError;
}

describe('ProductsService', () => {
  let prisma: {
    category: Record<string, jest.Mock>;
    product: Record<string, jest.Mock>;
  };
  let service: ProductsService;

  beforeEach(() => {
    prisma = {
      category: { findUnique: jest.fn() },
      product: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new ProductsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('rejects when the category does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          name: 'Assam Gold',
          description: 'desc',
          price: 100,
          sku: 'SKU-1',
          categoryId: 'missing-category',
        }),
      ).rejects.toBeInstanceOf(AppException);

      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('derives a unique slug from the name, appending a suffix on collision', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      // First candidate slug "assam-gold" is taken, "assam-gold-2" is free.
      prisma.product.findUnique
        .mockResolvedValueOnce({ id: 'other-product' })
        .mockResolvedValueOnce(null);
      prisma.product.create.mockResolvedValue({ id: 'new-product', slug: 'assam-gold-2' });

      await service.create({
        name: 'Assam Gold',
        description: 'desc',
        price: 100,
        sku: 'SKU-1',
        categoryId: 'cat-1',
      });

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ slug: 'assam-gold-2' }) }),
      );
    });

    it('maps a duplicate SKU constraint violation to DUPLICATE_SKU', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prisma.product.findUnique.mockResolvedValue(null);
      prisma.product.create.mockRejectedValue(prismaKnownError('P2002', ['sku']));

      await expect(
        service.create({
          name: 'Assam Gold',
          description: 'desc',
          price: 100,
          sku: 'DUPLICATE',
          categoryId: 'cat-1',
        }),
      ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'DUPLICATE_SKU' }) });
    });

    it('defaults isBestSeller to false when not provided', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prisma.product.findUnique.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue({ id: 'new-product' });

      await service.create({
        name: 'Assam Gold',
        description: 'desc',
        price: 100,
        sku: 'SKU-1',
        categoryId: 'cat-1',
      });

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isBestSeller: false }) }),
      );
    });
  });

  describe('findAll', () => {
    it('filters by isBestSeller when provided', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({ isBestSeller: true, skip: 0, take: 20 } as never);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isBestSeller: true }) }),
      );
    });

    it('does not filter by isBestSeller when omitted', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({ skip: 0, take: 20 } as never);

      const where = prisma.product.findMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('isBestSeller');
    });
  });

  describe('findOne', () => {
    it('throws PRODUCT_NOT_FOUND for a missing id', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toBeInstanceOf(AppException);
    });

    it('returns the product when found', async () => {
      const product = { id: 'p1', status: ProductStatus.ACTIVE };
      prisma.product.findUnique.mockResolvedValue(product);

      await expect(service.findOne('p1')).resolves.toBe(product);
    });
  });
});

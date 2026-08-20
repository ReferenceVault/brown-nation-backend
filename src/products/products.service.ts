import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, Product, ProductStatus } from '@prisma/client';

import { ErrorCode } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { slugify } from '../common/utils/slugify.util';
import { PrismaService } from '../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto): Promise<Product> {
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) {
      throw new AppException(ErrorCode.NOT_FOUND, 'Category not found', HttpStatus.BAD_REQUEST);
    }

    const slug = await this.resolveUniqueSlug(dto.slug ?? dto.name);

    try {
      return await this.prisma.product.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          price: dto.price,
          compareAtPrice: dto.compareAtPrice,
          sku: dto.sku,
          images: dto.images ?? [],
          categoryId: dto.categoryId,
          status: dto.status ?? ProductStatus.DRAFT,
          stockQuantity: dto.stockQuantity ?? 0,
          isBestSeller: dto.isBestSeller ?? false,
        },
      });
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async findAll(query: ProductQueryDto) {
    const where: Prisma.ProductWhereInput = {
      ...(query.status === 'ALL' ? {} : { status: query.status ?? ProductStatus.ACTIVE }),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.isBestSeller !== undefined ? { isBestSeller: query.isBestSeller } : {}),
      ...(query.minPrice !== undefined || query.maxPrice !== undefined
        ? {
            price: {
              ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
              ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
              { description: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
              { sku: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : {}),
    };

    // A read-only listing doesn't need transactional consistency between the
    // page of items and the total count, so run them in parallel instead of
    // inside a $transaction — that avoids extra BEGIN/COMMIT round trips to
    // the (remote) database on every request.
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new AppException(
        ErrorCode.PRODUCT_NOT_FOUND,
        'Product not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return product;
  }

  async findBySlug(slug: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { slug } });
    if (!product) {
      throw new AppException(
        ErrorCode.PRODUCT_NOT_FOUND,
        'Product not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return product;
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    await this.findOne(id);

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!category) {
        throw new AppException(ErrorCode.NOT_FOUND, 'Category not found', HttpStatus.BAD_REQUEST);
      }
    }

    const slug = dto.slug ? await this.resolveUniqueSlug(dto.slug, id) : undefined;

    try {
      return await this.prisma.product.update({
        where: { id },
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          price: dto.price,
          compareAtPrice: dto.compareAtPrice,
          sku: dto.sku,
          images: dto.images,
          categoryId: dto.categoryId,
          status: dto.status,
          stockQuantity: dto.stockQuantity,
          isBestSeller: dto.isBestSeller,
        },
      });
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.product.delete({ where: { id } });
  }

  private async resolveUniqueSlug(source: string, excludeId?: string): Promise<string> {
    const base = slugify(source);
    let candidate = base;
    let suffix = 1;

    while (true) {
      const existing = await this.prisma.product.findUnique({ where: { slug: candidate } });
      if (!existing || existing.id === excludeId) {
        return candidate;
      }
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
  }

  private mapWriteError(error: unknown): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = (error.meta?.target as string[] | undefined) ?? [];
      if (target.includes('sku')) {
        return new AppException(
          ErrorCode.DUPLICATE_SKU,
          'A product with this SKU already exists',
          HttpStatus.CONFLICT,
        );
      }
      if (target.includes('slug')) {
        return new AppException(
          ErrorCode.DUPLICATE_SLUG,
          'A product with this slug already exists',
          HttpStatus.CONFLICT,
        );
      }
    }
    return error;
  }
}

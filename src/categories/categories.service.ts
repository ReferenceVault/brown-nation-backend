import { Injectable, NotFoundException } from '@nestjs/common';
import { Category, Prisma } from '@prisma/client';

import { slugify } from '../common/utils/slugify.util';
import { PrismaService } from '../database/prisma.service';
import { CategoryQueryDto } from './dto/category-query.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto): Promise<Category> {
    const slug = await this.resolveUniqueSlug(dto.slug ?? dto.name);

    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        image: dto.image,
        status: dto.status,
        order: dto.order,
      },
    });
  }

  async findAll(query: CategoryQueryDto) {
    const where: Prisma.CategoryWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: Prisma.QueryMode.insensitive } }
        : {}),
    };

    // Read-only listing — see products.service.ts's findAll for why this runs
    // in parallel instead of inside a $transaction.
    const [items, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.category.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    await this.findOne(id);

    const slug = dto.slug ? await this.resolveUniqueSlug(dto.slug, id) : undefined;

    return this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        image: dto.image,
        status: dto.status,
        order: dto.order,
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.category.delete({ where: { id } });
  }

  private async resolveUniqueSlug(source: string, excludeId?: string): Promise<string> {
    const base = slugify(source);
    let candidate = base;
    let suffix = 1;

    while (true) {
      const existing = await this.prisma.category.findUnique({ where: { slug: candidate } });
      if (!existing || existing.id === excludeId) {
        return candidate;
      }
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
  }
}

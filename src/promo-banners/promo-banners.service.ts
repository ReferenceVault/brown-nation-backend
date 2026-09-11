import { Injectable, NotFoundException } from '@nestjs/common';
import { PromoBanner, Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import { CreatePromoBannerDto } from './dto/create-promo-banner.dto';
import { PromoBannerQueryDto } from './dto/promo-banner-query.dto';
import { UpdatePromoBannerDto } from './dto/update-promo-banner.dto';

@Injectable()
export class PromoBannersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePromoBannerDto): Promise<PromoBanner> {
    return this.prisma.promoBanner.create({ data: dto });
  }

  async findAll(query: PromoBannerQueryDto) {
    const where: Prisma.PromoBannerWhereInput = query.status ? { status: query.status } : {};

    const [items, total] = await Promise.all([
      this.prisma.promoBanner.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.promoBanner.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(id: string): Promise<PromoBanner> {
    const banner = await this.prisma.promoBanner.findUnique({ where: { id } });
    if (!banner) {
      throw new NotFoundException('Promo banner not found');
    }
    return banner;
  }

  async update(id: string, dto: UpdatePromoBannerDto): Promise<PromoBanner> {
    await this.findOne(id);
    return this.prisma.promoBanner.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.promoBanner.delete({ where: { id } });
  }
}

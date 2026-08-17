import { Injectable, NotFoundException } from '@nestjs/common';
import { HeroSlide, Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import { CreateHeroSlideDto } from './dto/create-hero-slide.dto';
import { HeroSlideQueryDto } from './dto/hero-slide-query.dto';
import { UpdateHeroSlideDto } from './dto/update-hero-slide.dto';

@Injectable()
export class HeroSlidesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateHeroSlideDto): Promise<HeroSlide> {
    return this.prisma.heroSlide.create({ data: dto });
  }

  async findAll(query: HeroSlideQueryDto) {
    const where: Prisma.HeroSlideWhereInput = query.status ? { status: query.status } : {};

    // Read-only listing — see products.service.ts's findAll for why this runs
    // in parallel instead of inside a $transaction.
    const [items, total] = await Promise.all([
      this.prisma.heroSlide.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.heroSlide.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(id: string): Promise<HeroSlide> {
    const slide = await this.prisma.heroSlide.findUnique({ where: { id } });
    if (!slide) {
      throw new NotFoundException('Hero slide not found');
    }
    return slide;
  }

  async update(id: string, dto: UpdateHeroSlideDto): Promise<HeroSlide> {
    await this.findOne(id);
    return this.prisma.heroSlide.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.heroSlide.delete({ where: { id } });
  }
}

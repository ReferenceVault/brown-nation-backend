import { Injectable, NotFoundException } from '@nestjs/common';
import { Announcement, Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import { AnnouncementQueryDto } from './dto/announcement-query.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAnnouncementDto): Promise<Announcement> {
    return this.prisma.announcement.create({ data: dto });
  }

  async findAll(query: AnnouncementQueryDto) {
    const where: Prisma.AnnouncementWhereInput = query.status ? { status: query.status } : {};

    const [items, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.announcement.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(id: string): Promise<Announcement> {
    const announcement = await this.prisma.announcement.findUnique({ where: { id } });
    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }
    return announcement;
  }

  async update(id: string, dto: UpdateAnnouncementDto): Promise<Announcement> {
    await this.findOne(id);
    return this.prisma.announcement.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.announcement.delete({ where: { id } });
  }
}

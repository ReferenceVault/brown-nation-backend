import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ContactEnquiry, Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateEnquiryDto } from './dto/create-enquiry.dto';
import { EnquiryQueryDto } from './dto/enquiry-query.dto';
import { UpdateEnquiryDto } from './dto/update-enquiry.dto';

@Injectable()
export class EnquiriesService {
  private readonly logger = new Logger(EnquiriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async create(dto: CreateEnquiryDto): Promise<ContactEnquiry> {
    const enquiry = await this.prisma.contactEnquiry.create({ data: dto });

    // Best-effort: the enquiry is already saved, so a transient email
    // provider issue shouldn't turn into a failed submission for the
    // customer — just log it and move on.
    try {
      await this.emailService.sendEnquiryNotification(dto);
      await this.emailService.sendEnquiryAutoReply(dto.email, dto.name);
    } catch (error) {
      this.logger.error(`Failed to send enquiry emails for ${enquiry.id}`, error as Error);
    }

    return enquiry;
  }

  async findAll(query: EnquiryQueryDto) {
    const where: Prisma.ContactEnquiryWhereInput = query.status ? { status: query.status } : {};

    const [items, total] = await Promise.all([
      this.prisma.contactEnquiry.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: query.sortOrder ?? 'desc' },
      }),
      this.prisma.contactEnquiry.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(id: string): Promise<ContactEnquiry> {
    const enquiry = await this.prisma.contactEnquiry.findUnique({ where: { id } });
    if (!enquiry) {
      throw new NotFoundException('Enquiry not found');
    }
    return enquiry;
  }

  async update(id: string, dto: UpdateEnquiryDto): Promise<ContactEnquiry> {
    await this.findOne(id);
    return this.prisma.contactEnquiry.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.contactEnquiry.delete({ where: { id } });
  }
}

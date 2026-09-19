import { Injectable } from '@nestjs/common';
import { NewsletterSubscriber } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class NewsletterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async subscribe(email: string): Promise<void> {
    const existing = await this.prisma.newsletterSubscriber.findUnique({ where: { email } });
    if (existing) {
      return;
    }

    await this.prisma.newsletterSubscriber.create({ data: { email } });
    await this.emailService.sendNewsletterWelcomeEmail(email);
  }

  async list(params: {
    skip: number;
    take: number;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ items: NewsletterSubscriber[]; total: number }> {
    // Read-only listing — see orders.service.ts's findAll for why this runs
    // in parallel instead of inside a $transaction.
    const [items, total] = await Promise.all([
      this.prisma.newsletterSubscriber.findMany({
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: params.sortOrder ?? 'desc' },
      }),
      this.prisma.newsletterSubscriber.count(),
    ]);

    return { items, total };
  }

  async remove(id: string): Promise<void> {
    await this.prisma.newsletterSubscriber.delete({ where: { id } });
  }
}

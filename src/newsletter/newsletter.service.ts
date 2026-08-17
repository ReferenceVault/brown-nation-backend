import { Injectable } from '@nestjs/common';

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
}

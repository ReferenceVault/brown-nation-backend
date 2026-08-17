import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppConfig } from '../config/configuration';
import { EMAIL_PROVIDER, EmailProvider } from './interfaces/email-provider.interface';

@Injectable()
export class EmailService {
  private readonly frontendUrl: string;

  constructor(
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<AppConfig>('app')!.frontendUrl;
  }

  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    const resetLink = `${this.frontendUrl}/reset-password?token=${resetToken}`;

    await this.provider.send({
      to,
      subject: 'Reset your Brown Nation password',
      text: `We received a request to reset your password. Use the link below within the next few minutes to choose a new one:\n\n${resetLink}\n\nIf you did not request this, you can safely ignore this email.`,
      html: `<p>We received a request to reset your password.</p><p><a href="${resetLink}">Click here to reset your password</a></p><p>If you did not request this, you can safely ignore this email.</p>`,
    });
  }

  async sendNewsletterWelcomeEmail(to: string): Promise<void> {
    await this.provider.send({
      to,
      subject: 'Welcome to Brown Nation',
      text: `Thanks for subscribing to the Brown Nation newsletter! You'll be the first to hear about new flavors and festive offers.\n\nVisit us any time: ${this.frontendUrl}`,
      html: `<p>Thanks for subscribing to the Brown Nation newsletter! You'll be the first to hear about new flavors and festive offers.</p><p><a href="${this.frontendUrl}">Visit Brown Nation</a></p>`,
    });
  }
}

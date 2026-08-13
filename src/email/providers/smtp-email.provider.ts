import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

import { EmailConfig } from '../../config/configuration';
import { EmailMessage, EmailProvider } from '../interfaces/email-provider.interface';

@Injectable()
export class SmtpEmailProvider implements EmailProvider, OnModuleInit {
  private readonly logger = new Logger('SmtpEmailProvider');
  private transporter: Transporter;
  private readonly config: EmailConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<EmailConfig>('email')!;
  }

  onModuleInit(): void {
    this.transporter = createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: this.config.smtpPort === 465,
      auth:
        this.config.smtpUser && this.config.smtpPassword
          ? { user: this.config.smtpUser, pass: this.config.smtpPassword }
          : undefined,
    });
  }

  async send(message: EmailMessage): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.config.smtpFrom,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    } catch (error) {
      this.logger.error(`Failed to send email to ${message.to}`, error as Error);
      throw error;
    }
  }
}

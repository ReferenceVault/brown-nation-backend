import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EmailConfig } from '../../config/configuration';
import { EmailMessage, EmailProvider } from '../interfaces/email-provider.interface';

const RESEND_API_URL = 'https://api.resend.com/emails';

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  private readonly logger = new Logger('ResendEmailProvider');
  private readonly config: EmailConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<EmailConfig>('email')!;
  }

  async send(message: EmailMessage): Promise<void> {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.config.resendFromEmail,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`Failed to send email to ${message.to}: ${res.status} ${body}`);
      throw new Error(`Resend API request failed with status ${res.status}`);
    }
  }
}

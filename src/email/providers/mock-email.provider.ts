import { Injectable, Logger } from '@nestjs/common';

import { EmailMessage, EmailProvider } from '../interfaces/email-provider.interface';

/**
 * Local-dev stand-in for a real email provider: logs the message instead of
 * sending it, so auth flows (password reset, etc.) work without SMTP setup.
 */
@Injectable()
export class MockEmailProvider implements EmailProvider {
  private readonly logger = new Logger('MockEmailProvider');

  async send(message: EmailMessage): Promise<void> {
    this.logger.log(`[MOCK EMAIL] to=${message.to} subject="${message.subject}"\n${message.text}`);
    return Promise.resolve();
  }
}

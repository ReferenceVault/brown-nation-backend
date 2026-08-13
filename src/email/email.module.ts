import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EmailConfig } from '../config/configuration';
import { EmailService } from './email.service';
import { EMAIL_PROVIDER } from './interfaces/email-provider.interface';
import { MockEmailProvider } from './providers/mock-email.provider';
import { SmtpEmailProvider } from './providers/smtp-email.provider';

@Module({
  providers: [
    MockEmailProvider,
    SmtpEmailProvider,
    {
      provide: EMAIL_PROVIDER,
      useFactory: (
        configService: ConfigService,
        mock: MockEmailProvider,
        smtp: SmtpEmailProvider,
      ) => {
        const emailConfig = configService.get<EmailConfig>('email')!;
        return emailConfig.provider === 'smtp' ? smtp : mock;
      },
      inject: [ConfigService, MockEmailProvider, SmtpEmailProvider],
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}

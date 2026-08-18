import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EmailConfig } from '../config/configuration';
import { EmailService } from './email.service';
import { EMAIL_PROVIDER } from './interfaces/email-provider.interface';
import { MockEmailProvider } from './providers/mock-email.provider';
import { ResendEmailProvider } from './providers/resend-email.provider';
import { SmtpEmailProvider } from './providers/smtp-email.provider';

@Module({
  providers: [
    MockEmailProvider,
    SmtpEmailProvider,
    ResendEmailProvider,
    {
      provide: EMAIL_PROVIDER,
      useFactory: (
        configService: ConfigService,
        mock: MockEmailProvider,
        smtp: SmtpEmailProvider,
        resend: ResendEmailProvider,
      ) => {
        const emailConfig = configService.get<EmailConfig>('email')!;
        if (emailConfig.provider === 'smtp') return smtp;
        if (emailConfig.provider === 'resend') return resend;
        return mock;
      },
      inject: [ConfigService, MockEmailProvider, SmtpEmailProvider, ResendEmailProvider],
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}

export interface AppConfig {
  env: string;
  port: number;
  appUrl: string;
  frontendUrl: string;
  swaggerEnabled: boolean;
  swaggerPath: string;
  logLevel: string;
  corsOrigins: string[];
  throttle: {
    ttlMs: number;
    limit: number;
  };
}

export interface DatabaseConfig {
  url: string;
}

export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
  passwordResetTokenTtlMinutes: number;
  emailVerificationTokenTtlMinutes: number;
}

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  forcePathStyle: boolean;
  publicUrl: string;
}

export interface PaymentConfig {
  provider: 'mock' | 'stripe' | 'razorpay';
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  razorpayWebhookSecret?: string;
}

export interface EmailConfig {
  provider: 'mock' | 'smtp' | 'resend';
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFrom: string;
  resendApiKey?: string;
  resendFromEmail: string;
  contactNotificationEmail: string;
}

export default () => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    appUrl: process.env.APP_URL ?? 'http://localhost:3000',
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3001',
    swaggerEnabled: (process.env.SWAGGER_ENABLED ?? 'true') === 'true',
    swaggerPath: process.env.SWAGGER_PATH ?? 'docs',
    logLevel: process.env.LOG_LEVEL ?? 'info',
    corsOrigins: (process.env.CORS_ORIGIN ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    throttle: {
      ttlMs: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
      limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
    },
  } satisfies AppConfig,
  database: {
    url: process.env.DATABASE_URL ?? '',
  } satisfies DatabaseConfig,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    passwordResetTokenTtlMinutes: parseInt(
      process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES ?? '30',
      10,
    ),
    emailVerificationTokenTtlMinutes: parseInt(
      process.env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES ?? '1440',
      10,
    ),
  } satisfies JwtConfig,
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? '',
    region: process.env.S3_REGION ?? 'us-east-1',
    bucket: process.env.S3_BUCKET ?? '',
    accessKey: process.env.S3_ACCESS_KEY ?? '',
    secretKey: process.env.S3_SECRET_KEY ?? '',
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
    publicUrl: process.env.S3_PUBLIC_URL ?? '',
  } satisfies S3Config,
  payment: {
    provider: (process.env.PAYMENT_PROVIDER ?? 'mock') as 'mock' | 'stripe' | 'razorpay',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
    razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  } satisfies PaymentConfig,
  email: {
    provider: (process.env.EMAIL_PROVIDER ?? 'mock') as 'mock' | 'smtp' | 'resend',
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined,
    smtpUser: process.env.SMTP_USER,
    smtpPassword: process.env.SMTP_PASSWORD,
    smtpFrom: process.env.SMTP_FROM ?? 'no-reply@brownnation.com',
    resendApiKey: process.env.RESEND_API_KEY,
    resendFromEmail: process.env.RESEND_FROM_EMAIL ?? 'no-reply@brownnation.in',
    contactNotificationEmail:
      process.env.CONTACT_NOTIFICATION_EMAIL ?? 'brownnation.choco@gmail.com',
  } satisfies EmailConfig,
});

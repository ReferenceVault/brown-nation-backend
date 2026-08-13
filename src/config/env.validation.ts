import { plainToInstance } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

class EnvironmentVariables {
  @IsIn([Environment.Development, Environment.Test, Environment.Production])
  NODE_ENV: Environment = Environment.Development;

  @IsNumberString()
  PORT = '3000';

  @IsString()
  APP_URL: string;

  @IsString()
  FRONTEND_URL: string;

  @IsString()
  @MinLength(10)
  DATABASE_URL: string;

  @IsString()
  @MinLength(32, { message: 'JWT_ACCESS_SECRET must be at least 32 characters long' })
  JWT_ACCESS_SECRET: string;

  @IsString()
  @MinLength(32, { message: 'JWT_REFRESH_SECRET must be at least 32 characters long' })
  JWT_REFRESH_SECRET: string;

  @IsString()
  JWT_ACCESS_EXPIRES_IN = '15m';

  @IsString()
  JWT_REFRESH_EXPIRES_IN = '7d';

  @IsNumberString()
  PASSWORD_RESET_TOKEN_TTL_MINUTES = '30';

  @IsString()
  CORS_ORIGIN = '';

  @IsNumberString()
  THROTTLE_TTL_MS = '60000';

  @IsNumberString()
  THROTTLE_LIMIT = '100';

  @IsIn(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
  LOG_LEVEL = 'info';

  @IsBooleanString()
  SWAGGER_ENABLED = 'true';

  @IsString()
  SWAGGER_PATH = 'docs';

  @IsString()
  S3_ENDPOINT: string;

  @IsString()
  S3_REGION = 'us-east-1';

  @IsString()
  S3_BUCKET: string;

  @IsString()
  S3_ACCESS_KEY: string;

  @IsString()
  S3_SECRET_KEY: string;

  @IsBooleanString()
  S3_FORCE_PATH_STYLE = 'true';

  @IsString()
  S3_PUBLIC_URL: string;

  @IsIn(['mock', 'stripe'])
  PAYMENT_PROVIDER = 'mock';

  @IsOptional()
  @IsString()
  STRIPE_SECRET_KEY?: string;

  @IsOptional()
  @IsString()
  STRIPE_WEBHOOK_SECRET?: string;

  @IsIn(['mock', 'smtp'])
  EMAIL_PROVIDER = 'mock';

  @IsOptional()
  @IsString()
  SMTP_HOST?: string;

  @IsOptional()
  @IsNumberString()
  SMTP_PORT?: string;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASSWORD?: string;

  @IsOptional()
  @IsString()
  SMTP_FROM?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Environment variable validation failed: ${messages}`);
  }

  return validatedConfig;
}

import { join } from 'node:path';

import fastifyHelmet from '@fastify/helmet';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import { NestFastifyApplication } from '@nestjs/platform-fastify';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { validationExceptionFactory } from './common/pipes/validation-exception-factory';
import { AppConfig } from './config/configuration';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Shared app configuration (pipes, filters, interceptors, security
 * middleware) applied identically in production bootstrap and in E2E tests,
 * so tests exercise the exact same request pipeline as the running app.
 */
export async function configureApp(app: NestFastifyApplication): Promise<AppConfig> {
  const configService = app.get(ConfigService);
  const appConfig = configService.get<AppConfig>('app')!;

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: appConfig.env === 'production' ? undefined : false,
    // Product images under /uploads are fetched cross-origin by the frontend
    // (different port in dev); the default "same-origin" policy would block them.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  // Temporary local file serving for product images, until S3 is wired up.
  await app.register(fastifyStatic, {
    root: join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
  });

  // Backs the local image-upload endpoint (UploadsModule) — the local-storage
  // counterpart to StorageService's S3 presigned-upload flow.
  await app.register(fastifyMultipart, {
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  });

  app.enableCors({
    origin: appConfig.corsOrigins.length > 0 ? appConfig.corsOrigins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: validationExceptionFactory,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));
  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));

  return appConfig;
}

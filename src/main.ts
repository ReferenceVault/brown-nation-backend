import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      // 6MB request body cap — sized to cover image uploads (see UploadsModule's
      // 5MB fileSize limit) on top of ordinary JSON request bodies.
      bodyLimit: 6 * 1024 * 1024,
      trustProxy: true,
    }),
    { bufferLogs: true, rawBody: true },
  );

  app.useLogger(app.get(Logger));

  const appConfig = await configureApp(app);

  if (appConfig.swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Brown Nation API')
      .setDescription('E-commerce backend API for Brown Nation')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .addTag('auth', 'Authentication & session management')
      .addTag('users', 'User account management')
      .addTag('categories', 'Product categories')
      .addTag('products', 'Product catalog')
      .addTag('cart', 'Shopping cart')
      .addTag('orders', 'Order management')
      .addTag('payments', 'Payments & webhooks')
      .addTag('uploads', 'Local image uploads (temporary, pre-S3)')
      .addTag('newsletter', 'Newsletter subscriptions')
      .addTag('hero-slides', 'Homepage hero carousel content')
      .addTag('enquiries', 'Contact form enquiries')
      .addTag('health', 'Health checks')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(appConfig.swaggerPath, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(appConfig.port, '0.0.0.0');
}

void bootstrap();

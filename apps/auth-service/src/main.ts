import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { createLogger } from '@edgesphere/logger';

const logger = createLogger('auth-service');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // ─── Global Pipes ──────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // strip unknown properties
      forbidNonWhitelisted: true,
      transform: true,        // auto-transform types
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ─── CORS ──────────────────────────────────────────────────────
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3100',
    credentials: true,
  });

  // ─── Swagger / OpenAPI ─────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('EdgeSphere Auth Service')
      .setDescription('Authentication & Authorization API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
    logger.info('Swagger docs available at http://localhost:3001/docs');
  }

  // ─── Start ─────────────────────────────────────────────────────
  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.info({ port }, `Auth service listening on port ${port}`);
}

bootstrap().catch((err) => {
  logger.error(err, 'Failed to start auth service');
  process.exit(1);
});

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('EdgeSphere Analytics Service')
    .setDescription('Real-time analytics ingestion and query service powered by Kafka + TimescaleDB')
    .setVersion('1.0')
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('PORT', 3003);
  await app.listen(port);
  Logger.log(`Analytics Service is running on: http://localhost:${port}`, 'Bootstrap');
}
bootstrap();
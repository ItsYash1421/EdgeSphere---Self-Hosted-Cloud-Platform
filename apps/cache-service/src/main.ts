import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.enableCors();
  
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3004);
  
  await app.listen(port);
  console.log(`Cache Invalidation Service is running on port ${port}`);
}
bootstrap();

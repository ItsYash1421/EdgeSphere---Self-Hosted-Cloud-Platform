import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;
  
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  
  await app.listen(port);
  console.log(`Gateway running on port ${port}`);
}
bootstrap();

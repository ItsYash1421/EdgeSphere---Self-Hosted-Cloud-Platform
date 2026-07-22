import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: '*' });
  app.useWebSocketAdapter(new IoAdapter(app));
  await app.listen(process.env.PORT || 3006);
  console.log(`WebSocket Gateway running on port ${process.env.PORT || 3006}`);
}
bootstrap();

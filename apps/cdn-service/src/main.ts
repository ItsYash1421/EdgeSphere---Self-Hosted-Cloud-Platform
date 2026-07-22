import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ConfigService } from "@nestjs/config";
import type { NestExpressApplication } from "@nestjs/platform-express";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  
  const configService = app.get(ConfigService);
  const port = configService.get<number>("PORT") || 8080;
  
  // Enable raw body parsing for streaming/buffer processing
  app.useBodyParser("raw", { limit: "50mb" });
  app.enableCors();
  
  await app.listen(port);
  console.log(`CDN Edge Service running on port ${port}`);
}
bootstrap();

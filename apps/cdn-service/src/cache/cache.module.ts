import { Module, Global } from "@nestjs/common";
import { CacheService } from "./cache.service";
import { CacheController } from "./cache.controller";
import { ConfigModule, ConfigService } from "@nestjs/config";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [CacheService],
  controllers: [CacheController],
  exports: [CacheService],
})
export class CacheModule {}

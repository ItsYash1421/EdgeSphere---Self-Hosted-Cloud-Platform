import { Module } from "@nestjs/common";
import { CdnController } from "./cdn.controller";
import { CdnService } from "./cdn.service";
import { ImageOptimizerService } from "./image-optimizer.service";
import { CacheModule } from "../cache/cache.module";

@Module({
  imports: [CacheModule],
  controllers: [CdnController],
  providers: [CdnService, ImageOptimizerService],
  exports: [CdnService],
})
export class CdnModule {}

import { Controller, Get } from "@nestjs/common";
import { CacheService } from "../cache/cache.service";
import { ConfigService } from "@nestjs/config";

@Controller("health")
export class HealthController {
  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  async checkHealth() {
    let redisStatus = "down";
    try {
      const info = await this.cacheService.getInfo();
      if (info) redisStatus = "up";
    } catch (error) {
      redisStatus = "down";
    }

    return {
      status: "ok",
      region: this.configService.get("EDGE_REGION") || "us-east-1",
      redis: redisStatus,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}

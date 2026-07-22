import { Controller, Post, Body, Get, Delete, Param, Headers, UnauthorizedException } from "@nestjs/common";
import { CacheService } from "./cache.service";
import { ConfigService } from "@nestjs/config";

@Controller("cache")
export class CacheController {
  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  private validateKey(key: string) {
    const internalKey = this.configService.get("INTERNAL_API_KEY");
    if (key !== internalKey) {
      throw new UnauthorizedException("Invalid API Key");
    }
  }

  @Post("purge")
  async purge(
    @Headers("X-Internal-Key") internalKey: string,
    @Body() body: { bucket: string; key?: string }
  ) {
    this.validateKey(internalKey);
    let pattern = `cdn:*:${body.bucket}:*`;
    if (body.key) {
      pattern = `cdn:*:${body.bucket}:${body.key}:*`;
    }
    const count = await this.cacheService.deletePattern(pattern);
    await this.cacheService.publishInvalidation(body);
    return { success: true, count, message: `Purged ${count} items` };
  }

  @Get("stats")
  async getStats(@Headers("X-Internal-Key") internalKey: string) {
    this.validateKey(internalKey);
    return await this.cacheService.getInfo();
  }

  @Delete("flush/:region")
  async flushRegion(
    @Headers("X-Internal-Key") internalKey: string,
    @Param("region") region: string
  ) {
    this.validateKey(internalKey);
    const pattern = `cdn:${region}:*`;
    const count = await this.cacheService.deletePattern(pattern);
    return { success: true, count, message: `Flushed ${count} items for region ${region}` };
  }
}

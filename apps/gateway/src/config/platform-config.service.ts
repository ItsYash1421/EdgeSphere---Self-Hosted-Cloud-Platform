import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

export interface PlatformConfig {
  cacheTtlSeconds: number;
  maxFileSizeMb: number;
  rateLimitPerIp: number;
}

const DEFAULTS: PlatformConfig = {
  cacheTtlSeconds: 3600,
  maxFileSizeMb: 5120,
  rateLimitPerIp: 100,
};

// Physical Redis key shared across services (gateway, cdn-service, storage-service all
// resolve to this same key — see each service's own keyPrefix handling).
export const PLATFORM_CONFIG_KEY = 'edgesphere:platform_config';

@Injectable()
export class PlatformConfigService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async getConfig(): Promise<PlatformConfig> {
    const raw = await this.redis.hgetall(PLATFORM_CONFIG_KEY);
    return {
      cacheTtlSeconds: raw.cacheTtlSeconds ? parseInt(raw.cacheTtlSeconds, 10) : DEFAULTS.cacheTtlSeconds,
      maxFileSizeMb: raw.maxFileSizeMb ? parseInt(raw.maxFileSizeMb, 10) : DEFAULTS.maxFileSizeMb,
      rateLimitPerIp: raw.rateLimitPerIp ? parseInt(raw.rateLimitPerIp, 10) : DEFAULTS.rateLimitPerIp,
    };
  }

  async updateConfig(updates: Partial<PlatformConfig>): Promise<PlatformConfig> {
    const fields: Record<string, string> = {};
    if (updates.cacheTtlSeconds !== undefined) fields.cacheTtlSeconds = String(updates.cacheTtlSeconds);
    if (updates.maxFileSizeMb !== undefined) fields.maxFileSizeMb = String(updates.maxFileSizeMb);
    if (updates.rateLimitPerIp !== undefined) fields.rateLimitPerIp = String(updates.rateLimitPerIp);

    if (Object.keys(fields).length > 0) {
      await this.redis.hset(PLATFORM_CONFIG_KEY, fields);
    }
    return this.getConfig();
  }

  async getRateLimitPerIp(): Promise<number> {
    const val = await this.redis.hget(PLATFORM_CONFIG_KEY, 'rateLimitPerIp');
    return val ? parseInt(val, 10) : DEFAULTS.rateLimitPerIp;
  }
}

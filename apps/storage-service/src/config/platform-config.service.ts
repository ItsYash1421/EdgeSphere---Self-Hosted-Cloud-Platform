import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// Reads the same admin-configurable settings the gateway exposes at /config.
// Physical key must match gateway's PLATFORM_CONFIG_KEY exactly — this client has no
// keyPrefix (unlike cdn-service's), so the literal string is used as-is.
const PLATFORM_CONFIG_KEY = 'edgesphere:platform_config';

@Injectable()
export class PlatformConfigService implements OnModuleDestroy {
  private readonly logger = new Logger(PlatformConfigService.name);
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST') || 'localhost',
      port: this.configService.get<number>('REDIS_PORT') || 6379,
      password: this.configService.get<string>('REDIS_PASSWORD'),
      lazyConnect: false,
    });
    this.redis.on('error', (err) => this.logger.warn(`Redis unavailable for platform config: ${err.message}`));
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => undefined);
  }

  async getMaxFileSizeMb(defaultMb: number): Promise<number> {
    try {
      const val = await this.redis.hget(PLATFORM_CONFIG_KEY, 'maxFileSizeMb');
      return val ? parseInt(val, 10) : defaultMb;
    } catch {
      return defaultMb;
    }
  }
}

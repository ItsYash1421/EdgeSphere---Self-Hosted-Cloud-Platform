import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private redisClient: Redis;
  private redisSubscriber: Redis;
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>("REDIS_HOST") || "localhost";
    const port = this.configService.get<number>("REDIS_PORT") || 6379;
    const password = this.configService.get<string>("REDIS_PASSWORD");

    this.redisClient = new Redis({ host, port, password, keyPrefix: "edgesphere:" });
    this.redisSubscriber = new Redis({ host, port, password, keyPrefix: "edgesphere:" });
  }

  async onModuleInit() {
    this.logger.log("Redis connected for cache service");
  }

  async onModuleDestroy() {
    await this.redisClient.quit();
    await this.redisSubscriber.quit();
  }

  async set(key: string, value: Buffer | string, ttlSeconds: number): Promise<void> {
    const bufferValue = Buffer.isBuffer(value) ? value : Buffer.from(value);
    await this.redisClient.setex(key, ttlSeconds, bufferValue);
  }

  async get(key: string): Promise<Buffer | null> {
    const data = await this.redisClient.getBuffer(key);
    return data ? data : null;
  }

  async delete(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  async deletePattern(pattern: string): Promise<number> {
    let cursor = "0";
    let count = 0;
    do {
      const result = await this.redisClient.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = result[0];
      const keys = result[1];
      if (keys.length > 0) {
        const keysWithoutPrefix = keys.map(k => k.replace("edgesphere:", ""));
        await this.redisClient.del(...keysWithoutPrefix);
        count += keys.length;
      }
    } while (cursor !== "0");
    return count;
  }

  async getTTL(key: string): Promise<number> {
    return await this.redisClient.ttl(key);
  }

  async publishInvalidation(event: { bucket: string; key?: string }): Promise<void> {
    await this.redisClient.publish("cache:invalidate", JSON.stringify(event));
  }

  async subscribeToInvalidation(handler: (event: any) => void): Promise<void> {
    await this.redisSubscriber.subscribe("cache:invalidate");
    this.redisSubscriber.on("message", (channel, message) => {
      if (channel === "edgesphere:cache:invalidate" || channel === "cache:invalidate") {
        try {
          const event = JSON.parse(message);
          handler(event);
        } catch (error) {
          this.logger.error("Error parsing invalidation message", error);
        }
      }
    });
  }

  async getInfo(): Promise<{ used_memory_human: string; keyspace_hits: string; keyspace_misses: string }> {
    const info = await this.redisClient.info("memory");
    const stats = await this.redisClient.info("stats");
    
    const parseInfo = (str: string, key: string) => {
      const match = str.match(new RegExp(`^${key}:(.*)$`, "m"));
      return match ? match[1].trim() : "0";
    };

    return {
      used_memory_human: parseInfo(info, "used_memory_human"),
      keyspace_hits: parseInfo(stats, "keyspace_hits"),
      keyspace_misses: parseInfo(stats, "keyspace_misses"),
    };
  }
}

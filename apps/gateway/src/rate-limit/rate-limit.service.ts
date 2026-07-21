import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class RateLimitService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly metricsService: MetricsService,
  ) {}

  async tokenBucket(identifier: string, capacity: number = 100, refillRatePerSec: number = 10) {
    const key = `ratelimit:tb:${identifier}`;
    const now = Date.now();
    
    const [tokensStr, lastRefillStr] = await this.redis.hmget(key, 'tokens', 'lastRefill');
    
    let tokens = tokensStr ? parseFloat(tokensStr) : capacity;
    const lastRefill = lastRefillStr ? parseInt(lastRefillStr, 10) : now;
    
    if (tokensStr && lastRefillStr) {
      const deltaSec = (now - lastRefill) / 1000;
      tokens = Math.min(capacity, tokens + deltaSec * refillRatePerSec);
    }
    
    let allowed = false;
    if (tokens >= 1) {
      tokens -= 1;
      allowed = true;
    } else {
      this.metricsService.recordRateLimitHit('token_bucket');
    }
    
    await this.redis.hmset(key, {
      tokens: tokens.toString(),
      lastRefill: now.toString(),
    });
    await this.redis.expire(key, 60);
    
    return {
      allowed,
      remaining: Math.floor(tokens),
      resetAt: new Date(now + 1000 * Math.ceil((1 - tokens) / refillRatePerSec)),
    };
  }

  async slidingWindow(identifier: string, limit: number = 100, windowMs: number = 60000) {
    const key = `ratelimit:sw:${identifier}`;
    const now = Date.now();
    const requestId = uuidv4();
    
    const pipeline = this.redis.pipeline();
    pipeline.zadd(key, now, requestId);
    pipeline.zremrangebyscore(key, 0, now - windowMs);
    pipeline.zcard(key);
    pipeline.expire(key, Math.ceil(windowMs / 1000));
    
    const results = await pipeline.exec();
    
    let allowed = true;
    let count = 0;
    
    if (results && results[2] && !results[2][0]) {
      count = results[2][1] as number;
      if (count > limit) {
        allowed = false;
        this.metricsService.recordRateLimitHit('sliding_window');
      }
    }
    
    return {
      allowed,
      remaining: Math.max(0, limit - count),
      resetAt: new Date(now + windowMs),
    };
  }
}

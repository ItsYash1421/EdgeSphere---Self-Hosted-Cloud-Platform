import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { MetricsService } from '../metrics/metrics.service';

export interface PurgeResult {
  purgeId: string;
  keysDeleted: number;
  regions: string[];
  timestamp: string;
}

export interface PurgeRecord {
  purgeId: string;
  type: string;
  bucket?: string;
  key?: string;
  prefix?: string;
  timestamp: string;
  keysDeleted: number;
}

@Injectable()
export class InvalidationService {
  private readonly logger = new Logger(InvalidationService.name);
  private readonly subscriberRedis: Redis;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly metricsService: MetricsService,
  ) {
    this.subscriberRedis = this.redis.duplicate();
  }

  private async executePurge(pattern: string, type: 'file' | 'bucket' | 'prefix' | 'all', details: Partial<PurgeRecord>): Promise<PurgeResult> {
    const startTime = Date.now();
    const purgeId = uuidv4();
    const timestamp = new Date().toISOString();
    
    let keysDeleted = 0;
    
    if (pattern === '*') {
      // In a real multi-region deployment this would do more, but for now we flushdb or scan all
      // For safety, let's scan all cdn keys
      pattern = 'cdn:*';
    }

    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      
      if (keys.length > 0) {
        const pipeline = this.redis.pipeline();
        keys.forEach(key => pipeline.del(key));
        await pipeline.exec();
        keysDeleted += keys.length;
      }
    } while (cursor !== '0');

    // Publish event
    const eventPayload = {
      purgeId,
      timestamp,
      type,
      ...details
    };
    await this.redis.publish('cache:invalidate', JSON.stringify(eventPayload));

    // Log to history
    const record: PurgeRecord = {
      ...eventPayload,
      purgeId,
      timestamp,
      type,
      keysDeleted,
    };
    
    const pipeline = this.redis.pipeline();
    pipeline.lpush('purge:history', JSON.stringify(record));
    pipeline.ltrim('purge:history', 0, 99);
    await pipeline.exec();

    const durationSeconds = (Date.now() - startTime) / 1000;
    this.metricsService.recordPurgeOperation(type, durationSeconds, keysDeleted);

    this.logger.log(`Purged ${keysDeleted} keys matching ${pattern}`);

    return {
      purgeId,
      keysDeleted,
      regions: ['global'],
      timestamp,
    };
  }

  async purge(bucket: string, key: string): Promise<PurgeResult> {
    const pattern = `cdn:*:${bucket}/${key}:*`;
    return this.executePurge(pattern, 'file', { bucket, key });
  }

  async purgeBucket(bucket: string): Promise<PurgeResult> {
    const pattern = `cdn:*:${bucket}:*`;
    return this.executePurge(pattern, 'bucket', { bucket });
  }

  async purgePrefix(bucket: string, prefix: string): Promise<PurgeResult> {
    const pattern = `cdn:*:${bucket}/${prefix}*`;
    return this.executePurge(pattern, 'prefix', { bucket, prefix });
  }

  async purgeAll(): Promise<PurgeResult> {
    return this.executePurge('*', 'all', {});
  }

  async getPurgeHistory(limit: number = 100): Promise<PurgeRecord[]> {
    const history = await this.redis.lrange('purge:history', 0, limit - 1);
    return history.map(item => JSON.parse(item));
  }

  async getCacheStats(): Promise<{ totalKeys: number; memoryUsed: string }> {
    const info = await this.redis.info('memory');
    const memoryUsedMatch = info.match(/used_memory_human:(.*)/);
    const memoryUsed = memoryUsedMatch ? memoryUsedMatch[1].trim() : '0B';

    const dbSize = await this.redis.dbsize();

    return {
      totalKeys: dbSize,
      memoryUsed,
    };
  }

  async subscribeToStorageEvents(): Promise<void> {
    this.subscriberRedis.on('message', async (channel, message) => {
      if (channel === 'storage:events') {
        try {
          const event = JSON.parse(message);
          if (event.action === 'delete' || event.action === 'update') {
            this.logger.log(`Auto-invalidating ${event.bucket}/${event.key} due to storage ${event.action}`);
            await this.purge(event.bucket, event.key);
          }
        } catch (error) {
          this.logger.error('Failed to process storage event', error);
        }
      }
    });

    await this.subscriberRedis.subscribe('storage:events');
    this.logger.log('Subscribed to storage:events channel');
  }
}

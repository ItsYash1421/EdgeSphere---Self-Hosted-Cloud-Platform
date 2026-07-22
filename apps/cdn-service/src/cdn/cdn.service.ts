import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { CacheService } from "../cache/cache.service";
import { ImageOptimizerService, ImageTransformParams } from "./image-optimizer.service";
import { MetricsService } from "../metrics/metrics.service";
import { ConfigService } from "@nestjs/config";
import * as NodeCache from "node-cache";
import fetch from "node-fetch";

export interface CdnResponse {
  data: Buffer;
  contentType: string;
  etag: string;
  cacheHit: boolean;
  remainingTTL?: number;
}

export interface PurgeResult {
  success: boolean;
  count: number;
}

export interface CacheStats {
  memoryUsage: any;
  keys: number;
}

@Injectable()
export class CdnService implements OnModuleInit {
  private readonly logger = new Logger(CdnService.name);
  private memoryCache: NodeCache;
  private readonly region: string;
  private readonly originUrl: string;
  private readonly ttlSeconds: number;
  private readonly memTtlSeconds: number;

  constructor(
    private readonly cacheService: CacheService,
    private readonly imageOptimizer: ImageOptimizerService,
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService,
  ) {
    this.region = this.configService.get("EDGE_REGION") || "us-east-1";
    this.originUrl = this.configService.get("ORIGIN_URL") || "http://localhost:3002";
    this.ttlSeconds = this.configService.get("CACHE_TTL_SECONDS") || 3600;
    this.memTtlSeconds = this.configService.get("MEMORY_CACHE_TTL_SECONDS") || 300;
    
    this.memoryCache = new NodeCache({ stdTTL: this.memTtlSeconds, checkperiod: 60 });
  }

  async onModuleInit() {
    await this.cacheService.subscribeToInvalidation((event) => {
      this.logger.log(`Received invalidation event: ${JSON.stringify(event)}`);
      // Purge memory cache
      if (event.key) {
        const keys = this.memoryCache.keys().filter(k => k.includes(`:${event.bucket}:${event.key}:`));
        keys.forEach(k => this.memoryCache.del(k));
      } else if (event.bucket) {
        const keys = this.memoryCache.keys().filter(k => k.includes(`:${event.bucket}:`));
        keys.forEach(k => this.memoryCache.del(k));
      }
    });
  }

  async serveFile(bucket: string, key: string, transforms?: ImageTransformParams): Promise<CdnResponse> {
    const startTime = Date.now();
    const transformKey = transforms ? JSON.stringify(transforms) : "{}";
    const cacheKey = `cdn:${this.region}:${bucket}:${key}:${transformKey}`;

    // Step 2 & 3: Check Caches (Memory then Redis)
    const memData = this.memoryCache.get<any>(cacheKey);
    if (memData) {
      this.recordMetrics(bucket, "hit", transforms?.fmt, startTime);
      return { ...memData, cacheHit: true };
    }

    const redisData = await this.cacheService.get(cacheKey);
    if (redisData) {
      try {
        const parsed = JSON.parse(redisData.toString());
        const dataBuffer = Buffer.from(parsed.data, "base64");
        const ttl = await this.cacheService.getTTL(cacheKey);
        
        const response: CdnResponse = {
          data: dataBuffer,
          contentType: parsed.contentType,
          etag: parsed.etag,
          cacheHit: true,
          remainingTTL: ttl > 0 ? ttl : undefined,
        };

        this.memoryCache.set(cacheKey, response);
        this.recordMetrics(bucket, "hit", transforms?.fmt, startTime);
        return response;
      } catch (e) {
        this.logger.error("Error parsing Redis cache data", e);
      }
    }

    // Step 4: Fetch from Origin
    const originFetchStart = Date.now();
    const originReqUrl = `${this.originUrl}/storage/buckets/${bucket}/files/${key}`;
    const originRes = await fetch(originReqUrl);
    
    const fetchDuration = (Date.now() - originFetchStart) / 1000;
    this.metricsService.cdnOriginFetchDuration.labels(this.region).observe(fetchDuration);

    if (!originRes.ok) {
      throw new Error(`Origin error: ${originRes.statusText}`);
    }

    let contentType = originRes.headers.get("content-type") || "application/octet-stream";
    let data = await originRes.buffer();
    let etag = originRes.headers.get("etag") || `W/"${Date.now()}"`;

    // Step 5: Apply Image Transforms
    if (transforms && Object.keys(transforms).length > 0 && this.imageOptimizer.isImage(contentType)) {
      const transformStart = Date.now();
      const result = await this.imageOptimizer.transform(data, contentType, transforms);
      data = result.data;
      contentType = result.contentType;
      etag = `W/"${Date.now()}-opt"`;

      this.metricsService.cdnImageTransformsTotal.labels(contentType.split("/")[1] || "unknown", "unknown").inc();
      if (result.originalSize > result.optimizedSize) {
        this.metricsService.cdnImageOptimizationBytesSavedTotal.labels(contentType.split("/")[1] || "unknown").inc(result.originalSize - result.optimizedSize);
      }
    }

    // Step 6 & 7: Store in caches
    const cacheObject = {
      data: data.toString("base64"),
      contentType,
      etag
    };
    
    await this.cacheService.set(cacheKey, JSON.stringify(cacheObject), this.ttlSeconds);
    
    const response: CdnResponse = { data, contentType, etag, cacheHit: false };
    this.memoryCache.set(cacheKey, response);
    
    this.recordMetrics(bucket, "miss", transforms?.fmt, startTime);

    return response;
  }

  async purgeCache(bucket: string, key?: string): Promise<PurgeResult> {
    let pattern = `cdn:*:${bucket}:*`;
    if (key) {
      pattern = `cdn:*:${bucket}:${key}:*`;
    }
    const count = await this.cacheService.deletePattern(pattern);
    return { success: true, count };
  }

  async getCacheStats(): Promise<CacheStats> {
    return {
      memoryUsage: this.memoryCache.getStats(),
      keys: this.memoryCache.keys().length,
    };
  }

  private recordMetrics(bucket: string, cacheResult: string, format: string | undefined, startTime: number) {
    const duration = (Date.now() - startTime) / 1000;
    this.metricsService.cdnRequestsTotal.labels(this.region, bucket, cacheResult, format || "none").inc();
    this.metricsService.cdnRequestDuration.labels(this.region).observe(duration);
  }
}

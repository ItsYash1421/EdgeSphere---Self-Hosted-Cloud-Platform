import { Injectable } from "@nestjs/common";
import * as promClient from "prom-client";

@Injectable()
export class MetricsService {
  private readonly registry: promClient.Registry;

  public readonly cdnRequestsTotal: promClient.Counter<string>;
  public readonly cdnRequestDuration: promClient.Histogram<string>;
  public readonly cdnCacheSizeBytes: promClient.Gauge<string>;
  public readonly cdnBandwidthBytesTotal: promClient.Counter<string>;
  public readonly cdnImageTransformsTotal: promClient.Counter<string>;
  public readonly cdnImageOptimizationBytesSavedTotal: promClient.Counter<string>;
  public readonly cdnOriginFetchDuration: promClient.Histogram<string>;

  constructor() {
    this.registry = new promClient.Registry();
    
    promClient.collectDefaultMetrics({ register: this.registry, prefix: "cdn_" });

    this.cdnRequestsTotal = new promClient.Counter({
      name: "cdn_requests_total",
      help: "Total CDN requests",
      labelNames: ["region", "bucket", "cache_result", "format"],
      registers: [this.registry],
    });

    this.cdnRequestDuration = new promClient.Histogram({
      name: "cdn_request_duration_seconds",
      help: "CDN request duration",
      labelNames: ["region"],
      registers: [this.registry],
    });

    this.cdnCacheSizeBytes = new promClient.Gauge({
      name: "cdn_cache_size_bytes",
      help: "CDN cache size in bytes",
      labelNames: ["region"],
      registers: [this.registry],
    });

    this.cdnBandwidthBytesTotal = new promClient.Counter({
      name: "cdn_bandwidth_bytes_total",
      help: "Total bandwidth in bytes served",
      labelNames: ["region"],
      registers: [this.registry],
    });

    this.cdnImageTransformsTotal = new promClient.Counter({
      name: "cdn_image_transforms_total",
      help: "Total image transforms",
      labelNames: ["format", "from_format"],
      registers: [this.registry],
    });

    this.cdnImageOptimizationBytesSavedTotal = new promClient.Counter({
      name: "cdn_image_optimization_bytes_saved_total",
      help: "Bytes saved via optimization",
      labelNames: ["format"],
      registers: [this.registry],
    });

    this.cdnOriginFetchDuration = new promClient.Histogram({
      name: "cdn_origin_fetch_duration_seconds",
      help: "Origin fetch duration",
      labelNames: ["region"],
      registers: [this.registry],
    });
  }

  async getMetrics(): Promise<string> {
    return await this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}

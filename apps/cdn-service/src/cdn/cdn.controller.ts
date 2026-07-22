import { Controller, Get, Head, Param, Query, Res, Req, HttpException, HttpStatus } from "@nestjs/common";
import { CdnService } from "./cdn.service";
import { Response, Request } from "express";
import { ConfigService } from "@nestjs/config";
import { MetricsService } from "../metrics/metrics.service";
import { EventPublisherService } from "../events/event-publisher.service";

@Controller("cdn")
export class CdnController {
  constructor(
    private readonly cdnService: CdnService,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
    private readonly eventPublisher: EventPublisherService
  ) {}

  @Get("health")
  healthCheck() {
    return { status: "ok", service: "cdn-edge" };
  }

  @Head(":bucket/:key(*)")
  async headFile(
    @Param("bucket") bucket: string,
    @Param("key") key: string,
    @Query() query: any,
    @Req() req: Request,
    @Res() res: Response
  ) {
    await this.handleFileRequest(bucket, key, query, req, res, true);
  }

  @Get(":bucket/:key(*)")
  async getFile(
    @Param("bucket") bucket: string,
    @Param("key") key: string,
    @Query() query: any,
    @Req() req: Request,
    @Res() res: Response
  ) {
    await this.handleFileRequest(bucket, key, query, req, res, false);
  }

  private async handleFileRequest(
    bucket: string,
    key: string,
    query: any,
    req: Request,
    res: Response,
    isHead: boolean
  ) {
    const startTime = Date.now();
    try {
      const transforms = {
        w: query.w ? parseInt(query.w, 10) : undefined,
        h: query.h ? parseInt(query.h, 10) : undefined,
        fmt: query.fmt,
        q: query.q ? parseInt(query.q, 10) : undefined,
        fit: query.fit,
      };

      const result = await this.cdnService.serveFile(bucket, key, transforms);
      
      const region = this.configService.get("EDGE_REGION") || "unknown";

      res.set("X-Cache", result.cacheHit ? "HIT" : "MISS");
      res.set("X-Edge-Region", region);
      res.set("Cache-Control", `public, max-age=${result.remainingTTL || 3600}`);
      res.set("ETag", result.etag);
      res.set("Content-Type", result.contentType);
      res.set("Content-Length", result.data.length.toString());
      
      // Update bandwidth metric
      this.metricsService.cdnBandwidthBytesTotal.labels(region).inc(result.data.length);

      const latencyMs = Date.now() - startTime;
      this.eventPublisher.publishRequestEvent({
        time: new Date(),
        service: 'cdn-service',
        method: req.method,
        path: req.originalUrl,
        status: 200,
        latencyMs,
        ip: req.ip || 'unknown',
        cacheHit: result.cacheHit,
        bytes: result.data.length,
        edgeRegion: region,
        contentType: result.contentType,
      });

      if (isHead) {
        res.end();
      } else {
        res.send(result.data);
      }
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      this.eventPublisher.publishRequestEvent({
        time: new Date(),
        service: 'cdn-service',
        method: req.method,
        path: req.originalUrl,
        status: error.status || 500,
        latencyMs,
        ip: req.ip || 'unknown',
        cacheHit: false,
        bytes: 0,
      });

      if (error.message && error.message.includes("Origin error")) {
        throw new HttpException("File not found or origin error", HttpStatus.NOT_FOUND);
      }
      throw new HttpException("Internal Server Error", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

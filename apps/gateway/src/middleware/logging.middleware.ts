import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { MetricsService } from '../metrics/metrics.service';
import { EventPublisherService } from '../events/event-publisher.service';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  use(req: Request & { user?: any }, res: Response, next: NextFunction) {
    const requestId = uuidv4();
    req.headers['x-request-id'] = requestId;
    const startTime = Date.now();
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || '';

    res.on('finish', () => {
      const { statusCode } = res;
      const latency = Date.now() - startTime;
      const cacheHitHeader = res.getHeader('X-Cache') || res.getHeader('x-cache-hit');
      const cacheHit = cacheHitHeader === 'HIT';
      const userId = req.user?.sub || undefined;
      const contentLengthHeader = res.getHeader('content-length');
      const bytes = contentLengthHeader ? parseInt(contentLengthHeader as string, 10) : 0;
      const edgeRegion = process.env.EDGE_REGION || 'global';
      
      console.log(`[${requestId}] ${method} ${originalUrl} ${statusCode} - ${latency}ms - IP: ${ip} - Cache: ${cacheHit ? 'HIT' : 'MISS'} - User: ${userId || 'anonymous'} - Agent: ${userAgent}`);
      
      // Update metrics
      const service = originalUrl.split('/')[2] || 'unknown';
      this.metricsService.recordRequest(method, originalUrl, statusCode.toString(), service);
      this.metricsService.recordLatency(latency / 1000); // in seconds

      this.eventPublisher.publishRequestEvent({
        time: new Date(),
        service,
        method,
        path: originalUrl,
        status: statusCode,
        latencyMs: latency,
        userId,
        ip: ip || 'unknown',
        cacheHit,
        bytes,
        edgeRegion,
      });
    });

    next();
  }
}

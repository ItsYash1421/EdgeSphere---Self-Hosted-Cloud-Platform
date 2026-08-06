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

    // Skip internal infrastructure paths — Prometheus scrapes, health checks,
    // dashboard self-polling of analytics/notifications should NOT pollute
    // the request_events log. Real events = CDN serves, storage ops, auth,
    // cache purges. Think: Cloudflare analytics — you see end-user traffic,
    // not your own dashboard refreshing charts.
    const SKIP_PREFIXES = [
      '/metrics',
      '/health',
      '/favicon.ico',
      '/v1/analytics',      // dashboard polling its own charts
      '/v1/notifications/alerts/history',  // dashboard alert history tab
      '/v1/notifications/history',         // dashboard notification history
    ];
    const shouldSkip = SKIP_PREFIXES.some(p => originalUrl === p || originalUrl.startsWith(p + '?') || originalUrl.startsWith(p + '/'));

    res.on('finish', () => {
      const { statusCode } = res;
      const latency = Date.now() - startTime;
      const cacheHitHeader = res.getHeader('X-Cache') || res.getHeader('x-cache-hit');
      const cacheHit = cacheHitHeader === 'HIT';
      const userId = req.user?.sub || undefined;
      const contentLengthHeader = res.getHeader('content-length');
      const bytes = contentLengthHeader ? parseInt(contentLengthHeader as string, 10) : 0;
      const edgeRegion = process.env.EDGE_REGION || 'global';

      // Derive a clean service name from the path (e.g. /v1/auth/... → auth)
      const pathParts = originalUrl.split('/');
      const service = pathParts[1] === 'v1' ? (pathParts[2] || 'gateway') : (pathParts[1] || 'gateway');

      console.log(`[${requestId}] ${method} ${originalUrl} ${statusCode} - ${latency}ms - IP: ${ip} - Cache: ${cacheHit ? 'HIT' : 'MISS'} - User: ${userId || 'anonymous'} - Agent: ${userAgent}`);

      // Update Prometheus metrics (always — even for /metrics, /health)
      this.metricsService.recordRequest(method, originalUrl, statusCode.toString(), service);
      this.metricsService.recordLatency(latency / 1000);

      // Only publish to analytics DB for real user/CDN requests
      if (!shouldSkip) {
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
      }
    });

    next();
  }
}

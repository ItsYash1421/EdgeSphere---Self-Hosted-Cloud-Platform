import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request & { user?: any }, res: Response, next: NextFunction) {
    const requestId = uuidv4();
    req.headers['x-request-id'] = requestId;
    const startTime = Date.now();
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || '';

    res.on('finish', () => {
      const { statusCode } = res;
      const latency = Date.now() - startTime;
      const cacheHit = res.getHeader('x-cache-hit') || 'MISS';
      const userId = req.user?.sub || 'anonymous';
      
      console.log(`[${requestId}] ${method} ${originalUrl} ${statusCode} - ${latency}ms - IP: ${ip} - Cache: ${cacheHit} - User: ${userId} - Agent: ${userAgent}`);
      
      // Update metrics
      const service = originalUrl.split('/')[2] || 'unknown';
      this.metricsService.recordRequest(method, originalUrl, statusCode.toString(), service);
      this.metricsService.recordLatency(latency / 1000); // in seconds
    });

    next();
  }
}

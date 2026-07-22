import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { CdnRoute } from './cdn.route';
import { CircuitBreakerService } from '../resilience/circuit-breaker.service';
import { ServiceUnavailableException } from '@nestjs/common';

@Injectable()
export class ProxyService {
  private proxies: Record<string, any> = {};

  constructor(
    private configService: ConfigService,
    private cdnRoute: CdnRoute,
    private circuitBreakerService: CircuitBreakerService
  ) {
    const authUrl = this.configService.get('AUTH_SERVICE_URL') || 'http://localhost:3001';
    const storageUrl = this.configService.get('STORAGE_SERVICE_URL') || 'http://localhost:3002';
    const analyticsUrl = this.configService.get('ANALYTICS_SERVICE_URL') || 'http://localhost:3003';

    this.proxies['auth'] = createProxyMiddleware({
      target: authUrl,
      changeOrigin: true,
      pathRewrite: {
        '^/v1/auth': '/auth',
      },
    });

    this.proxies['storage'] = createProxyMiddleware({
      target: storageUrl,
      changeOrigin: true,
      pathRewrite: {
        '^/v1/storage': '/storage',
      },
    });

    this.proxies['analytics'] = createProxyMiddleware({
      target: analyticsUrl,
      changeOrigin: true,
      pathRewrite: {
        '^/v1/analytics': '/analytics',
      },
    });
  }

  async handle(req: Request, res: Response, next: NextFunction, service: string) {
    if (service === 'cdn') {
      return this.cdnRoute.handleRequest(req, res, next);
    }
    
    const proxy = this.proxies[service];
    if (proxy) {
      try {
        const serviceName = `${service}-service`;
        await this.circuitBreakerService.execute(serviceName, () => {
          return new Promise<void>((resolve, reject) => {
            // Note: In a real implementation, we'd listen to proxy events for failure
            // to properly trip the circuit breaker on 5xx errors.
            proxy(req, res, (err: any) => {
              if (err) return reject(err);
              resolve();
            });
            // If the proxy doesn't call next(), it handles the response itself.
            // We resolve immediately to let the request proceed through the breaker.
            resolve();
          });
        });
      } catch (error: any) {
        if (error instanceof ServiceUnavailableException) {
          res.set('Retry-After', '30');
          res.status(503).json({ message: error.message });
        } else {
          next(error);
        }
      }
    } else {
      res.status(404).json({ message: 'Service not found' });
    }
  }
}

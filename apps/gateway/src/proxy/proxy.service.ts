import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { CdnRoute } from './cdn.route';

@Injectable()
export class ProxyService {
  private proxies: Record<string, any> = {};

  constructor(
    private configService: ConfigService,
    private cdnRoute: CdnRoute
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
      proxy(req, res, next);
    } else {
      res.status(404).json({ message: 'Service not found' });
    }
  }
}

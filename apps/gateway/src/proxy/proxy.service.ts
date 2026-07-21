import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

@Injectable()
export class ProxyService {
  private proxies: Record<string, any> = {};

  constructor(private configService: ConfigService) {
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

  handle(req: Request, res: Response, next: NextFunction, service: string) {
    const proxy = this.proxies[service];
    if (proxy) {
      proxy(req, res, next);
    } else {
      res.status(404).json({ message: 'Service not found' });
    }
  }
}

import { All, Controller, Req, Res, Next } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ProxyService } from './proxy.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';

@Controller()
export class ProxyController {
  constructor(
    private readonly proxyService: ProxyService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  @All('cdn/*')
  async proxyCdn(
    @Req() req: Request & { user?: any },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    // Basic rate limit for CDN, or maybe skip?
    const ip = req.ip || 'unknown';
    const swLimit = await this.rateLimitService.slidingWindow(ip);
    if (!swLimit.allowed) {
      return res.status(429).json({ message: 'Too Many Requests' });
    }

    this.proxyService.handle(req, res, next, 'cdn');
  }

  @All('v1/:service/*')
  async proxyAll(
    @Req() req: Request & { user?: any },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    const service = req.params.service;
    
    // IP-based rate limiting (Sliding Window)
    const ip = req.ip || 'unknown';
    const swLimit = await this.rateLimitService.slidingWindow(ip);
    if (!swLimit.allowed) {
      return res.status(429).json({ message: 'Too Many Requests (IP)' });
    }

    // Token-based rate limiting if authenticated (Token Bucket)
    if (req.user && req.user.sub) {
      const tbLimit = await this.rateLimitService.tokenBucket(req.user.sub);
      if (!tbLimit.allowed) {
        return res.status(429).json({ message: 'Too Many Requests (User)' });
      }
    }

    this.proxyService.handle(req, res, next, service);
  }
}


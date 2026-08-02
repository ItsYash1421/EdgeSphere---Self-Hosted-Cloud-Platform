import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { PlatformConfigService } from '../config/platform-config.service';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private configService: ConfigService,
    private rateLimitService: RateLimitService,
    private platformConfigService: PlatformConfigService,
  ) {}

  async use(req: Request & { user?: any }, res: Response, next: NextFunction) {
    if (req.method === 'OPTIONS') {
      return next();
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized - Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];
    const secret = this.configService.get<string>('JWT_SECRET');

    try {
      if (!secret) {
        console.error('JWT_SECRET is not configured');
        return res.status(500).json({ message: 'Internal server error' });
      }
      
      const payload = jwt.verify(token, secret);
      req.user = payload;
      
      // Apply Rate Limiting (limit is admin-configurable via /config)
      const userId = (payload as any).sub || (payload as any).id || 'anonymous';
      const limit = await this.platformConfigService.getRateLimitPerIp();
      const rateLimitRes = await this.rateLimitService.slidingWindow(userId, limit);
      
      res.setHeader('X-RateLimit-Limit', limit.toString());
      res.setHeader('X-RateLimit-Remaining', rateLimitRes.remaining.toString());
      res.setHeader('X-RateLimit-Reset', Math.floor(rateLimitRes.resetAt.getTime() / 1000).toString());
      
      if (!rateLimitRes.allowed) {
        const retryAfter = Math.ceil((rateLimitRes.resetAt.getTime() - Date.now()) / 1000);
        res.setHeader('Retry-After', retryAfter.toString());
        return res.status(429).json({ message: 'Too Many Requests' });
      }

      next();
    } catch (error) {
      return res.status(401).json({ message: 'Unauthorized - Invalid token' });
    }
  }
}

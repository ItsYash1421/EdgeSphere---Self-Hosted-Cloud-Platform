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

    const apiKey = req.headers['x-api-key'] as string;
    const authHeader = req.headers.authorization;

    // ── Path 1: X-API-Key header ─────────────────────────────────────────────
    if (apiKey) {
      try {
        const authServiceUrl = this.configService.get('AUTH_SERVICE_URL') || 'http://localhost:3001';
        const response = await fetch(`${authServiceUrl}/auth/validate-key`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: apiKey }),
        });

        if (!response.ok) {
          return res.status(401).json({ message: 'Invalid or expired API key' });
        }

        const payload = await response.json();
        req.user = payload; // { sub, email, role, keyId }

        // Inject a short-lived JWT so downstream services (storage, auth)
        // which only understand Bearer tokens can accept this request.
        const secret = this.configService.get<string>('JWT_SECRET');
        if (secret) {
          const internalJwt = jwt.sign(
            { sub: payload.sub, email: payload.email, role: payload.role },
            secret,
            { expiresIn: '5m' },
          );
          req.headers['authorization'] = `Bearer ${internalJwt}`;
        }

        const limit = await this.platformConfigService.getRateLimitPerIp();
        const rateLimitRes = await this.rateLimitService.slidingWindow(payload.sub, limit);
        res.setHeader('X-RateLimit-Limit', limit.toString());
        res.setHeader('X-RateLimit-Remaining', rateLimitRes.remaining.toString());
        res.setHeader('X-RateLimit-Reset', Math.floor(rateLimitRes.resetAt.getTime() / 1000).toString());

        if (!rateLimitRes.allowed) {
          const retryAfter = Math.ceil((rateLimitRes.resetAt.getTime() - Date.now()) / 1000);
          res.setHeader('Retry-After', retryAfter.toString());
          return res.status(429).json({ message: 'Too Many Requests' });
        }

        return next();
      } catch {
        return res.status(401).json({ message: 'API key validation failed' });
      }
    }

    // ── Path 2: Bearer JWT ────────────────────────────────────────────────────
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

import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as crypto from 'crypto';

@Injectable()
export class CdnCacheMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CdnCacheMiddleware.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async use(req: Request, res: Response, next: NextFunction) {
    if (!req.path.startsWith('/cdn')) {
      return next();
    }

    if (req.method !== 'GET') {
      return next();
    }

    // Create a hash of query params
    const queryString = new URLSearchParams(req.query as any).toString();
    const queryHash = crypto.createHash('md5').update(queryString).digest('hex');
    const cacheKey = `gw:cdn:${req.path}:${queryHash}`;

    try {
      const cachedResponse = await this.redis.get(cacheKey);

      if (cachedResponse) {
        this.logger.debug(`CDN Gateway Cache HIT: ${cacheKey}`);
        res.setHeader('X-GW-Cache', 'HIT');
        
        // Parse metadata and data
        const { headers, data } = JSON.parse(cachedResponse);
        
        Object.entries(headers).forEach(([key, value]) => {
          res.setHeader(key, value as string);
        });
        
        // For actual binary data this would need a buffer, assuming string/json for now
        // A production cache would store binary in Redis properly or use an actual reverse proxy cache (like Nginx)
        return res.send(Buffer.from(data, 'base64'));
      }

      this.logger.debug(`CDN Gateway Cache MISS: ${cacheKey}`);
      res.setHeader('X-GW-Cache', 'MISS');

      // Intercept the response to cache it
      const originalWrite = res.write;
      const originalEnd = res.end;
      const chunks: Buffer[] = [];

      res.write = function (chunk: any, encodingOrCallback?: any, callback?: any): boolean {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        if (typeof encodingOrCallback === 'function') {
          return originalWrite.call(res, chunk, encodingOrCallback);
        }
        return originalWrite.call(res, chunk, encodingOrCallback, callback);
      };

      res.end = function (chunk?: any, encodingOrCallback?: any, callback?: any): Response {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        
        const bodyBuffer = Buffer.concat(chunks);
        
        // Only cache 200 OK responses
        if (res.statusCode === 200) {
          const cacheData = {
            headers: res.getHeaders(),
            data: bodyBuffer.toString('base64')
          };
          
          // Cache for 60 seconds
          this.redis.setex(cacheKey, 60, JSON.stringify(cacheData)).catch(err => {
            this.logger.error('Failed to cache CDN response', err);
          });
        }

        if (typeof encodingOrCallback === 'function') {
          return originalEnd.call(res, chunk, encodingOrCallback);
        }
        return originalEnd.call(res, chunk, encodingOrCallback, callback);
      }.bind(this);

    } catch (error) {
      this.logger.error('CDN Cache Middleware Error', error);
      // Proceed on error
    }

    next();
  }
}

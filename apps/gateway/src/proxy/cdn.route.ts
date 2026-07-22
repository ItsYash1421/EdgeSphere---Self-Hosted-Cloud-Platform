import { Request, Response, NextFunction } from 'express';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

@Injectable()
export class CdnRoute {
  private readonly logger = new Logger(CdnRoute.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async handleRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const cdnUrl = this.configService.get<string>('CDN_SERVICE_URL', 'http://localhost:8080');
      // The path will be something like /cdn/bucket/key
      const targetPath = req.originalUrl.replace(/^\/cdn/, '');
      
      const targetUrl = `${cdnUrl}${targetPath}`;

      this.logger.debug(`Forwarding CDN request to: ${targetUrl}`);

      const response = await this.httpService.axiosRef({
        method: req.method,
        url: targetUrl,
        responseType: 'stream',
        headers: {
          ...req.headers,
          host: new URL(cdnUrl).host, // adjust host header for target
        },
        validateStatus: () => true, // pass through errors as well
      });

      // Pass through headers
      Object.entries(response.headers).forEach(([key, value]) => {
        if (value) res.setHeader(key, value);
      });

      res.setHeader('X-Gateway-Region', 'global');

      response.data.pipe(res);
    } catch (error) {
      this.logger.error('CDN routing error', error);
      res.status(502).send({ message: 'Bad Gateway' });
    }
  }
}

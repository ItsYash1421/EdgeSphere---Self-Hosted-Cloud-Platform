import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ProxyModule } from './proxy/proxy.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { MetricsModule } from './metrics/metrics.module';
import { HealthModule } from './health/health.module';
import { AuthMiddleware } from './middleware/auth.middleware';
import { LoggingMiddleware } from './middleware/logging.middleware';
import { CdnCacheMiddleware } from './middleware/cdn-cache.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule.forRootAsync({
      useFactory: () => ({
        type: 'single',
        url: `redis://:${process.env.REDIS_PASSWORD || ''}@${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
      }),
    }),
    ProxyModule,
    RateLimitModule,
    MetricsModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggingMiddleware)
      .forRoutes('*');

    consumer
      .apply(CdnCacheMiddleware)
      .forRoutes({ path: 'cdn/*', method: RequestMethod.GET });

    consumer
      .apply(AuthMiddleware)
      .exclude(
        { path: 'v1/auth/register', method: RequestMethod.ALL },
        { path: 'v1/auth/login', method: RequestMethod.ALL },
        { path: 'health', method: RequestMethod.ALL },
        { path: 'metrics', method: RequestMethod.ALL },
        { path: 'cdn/(.*)', method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}

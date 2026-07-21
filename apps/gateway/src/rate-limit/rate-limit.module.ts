import { Module } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [MetricsModule],
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class RateLimitModule {}

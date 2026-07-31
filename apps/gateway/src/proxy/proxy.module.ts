import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ProxyService } from './proxy.service';
import { ProxyController } from './proxy.controller';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { ResilienceModule } from '../resilience/resilience.module';
import { CdnRoute } from './cdn.route';

@Module({
  imports: [RateLimitModule, HttpModule, ResilienceModule],
  providers: [ProxyService, CdnRoute],
  controllers: [ProxyController],
})
export class ProxyModule {}

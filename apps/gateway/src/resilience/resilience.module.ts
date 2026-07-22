import { Module } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker.service';
import { ResilienceController } from './resilience.controller';

@Module({
  controllers: [ResilienceController],
  providers: [CircuitBreakerService],
  exports: [CircuitBreakerService],
})
export class ResilienceModule {}

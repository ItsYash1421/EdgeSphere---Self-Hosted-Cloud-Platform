import { Controller, Get, Post, Param, NotFoundException } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker.service';

@Controller('resilience')
export class ResilienceController {
  constructor(private readonly circuitBreakerService: CircuitBreakerService) {}

  @Get('circuit-breakers')
  getStatus() {
    return this.circuitBreakerService.getStatus();
  }

  @Post('reset/:service')
  resetBreaker(@Param('service') service: string) {
    const success = this.circuitBreakerService.resetBreaker(service);
    if (!success) {
      throw new NotFoundException(`Circuit breaker for ${service} not found`);
    }
    return { message: `Circuit breaker for ${service} reset successfully` };
  }
}

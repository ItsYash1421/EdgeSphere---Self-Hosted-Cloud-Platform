import { Injectable, OnModuleInit, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as CircuitBreaker from 'opossum';

export interface CircuitStats {
  successes: number;
  failures: number;
  rejects: number;
  fallbacks: number;
  fires: number;
}

@Injectable()
export class CircuitBreakerService implements OnModuleInit {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private breakers = new Map<string, CircuitBreaker>();

  createBreaker(serviceName: string, fn: (...args: any[]) => Promise<any>): CircuitBreaker {
    const options: CircuitBreaker.Options = {
      timeout: 3000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      volumeThreshold: 5,
    };

    const breaker = new CircuitBreaker(fn, options);

    breaker.on('open', () => this.logger.warn(`Circuit OPEN for ${serviceName}`));
    breaker.on('close', () => this.logger.log(`Circuit CLOSED for ${serviceName}`));
    breaker.on('halfOpen', () => this.logger.log(`Circuit HALF-OPEN for ${serviceName}`));

    this.breakers.set(serviceName, breaker);
    return breaker;
  }

  async execute<T>(serviceName: string, fn: () => Promise<T>): Promise<T> {
    let breaker = this.breakers.get(serviceName);
    if (!breaker) {
      // Create a dummy wrapper if it doesn't exist
      breaker = this.createBreaker(serviceName, async (f: () => Promise<any>) => f());
    }

    try {
      return await breaker.fire(fn) as T;
    } catch (error: any) {
      if (error.code === 'EOPENBREAKER' || (error.message && error.message.includes('Breaker is open'))) {
        throw new ServiceUnavailableException({
          message: `Service ${serviceName} is unavailable`,
          retryAfter: 30
        });
      }
      throw error;
    }
  }

  getStatus() {
    const status: any[] = [];
    this.breakers.forEach((breaker, service) => {
      const stats = breaker.stats;
      status.push({
        service,
        state: breaker.opened ? 'OPEN' : breaker.halfOpen ? 'HALF_OPEN' : 'CLOSED',
        stats: {
          successCount: stats.successes,
          failureCount: stats.failures,
          rejectCount: stats.rejects,
          fallbackCount: stats.fallbacks,
          totalCount: stats.fires
        }
      });
    });
    return status;
  }

  getBreakerState(service: string) {
    const breaker = this.breakers.get(service);
    if (!breaker) return 'CLOSED';
    return breaker.opened ? 'OPEN' : breaker.halfOpen ? 'HALF_OPEN' : 'CLOSED';
  }

  resetBreaker(service: string) {
    const breaker = this.breakers.get(service);
    if (breaker) {
      breaker.close();
      return true;
    }
    return false;
  }

  onModuleInit() {
    const services = ['auth-service', 'storage-service', 'analytics-service', 'cdn-service', 'cache-service'];
    
    // We create generic breakers that take a function and execute it
    const executor = async (fn: (...args: any[]) => Promise<any>) => {
      return await fn();
    };

    services.forEach(service => {
      this.createBreaker(service, executor);
    });
  }
}

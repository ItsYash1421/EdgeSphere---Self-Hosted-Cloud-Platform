import { Controller, Get, Inject } from '@nestjs/common';
import { CircuitBreakerService } from '../resilience/circuit-breaker.service';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  private startTime: number;

  constructor(
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly configService: ConfigService
  ) {
    this.startTime = Date.now();
  }

  @Get()
  async check() {
    const servicesList = ['auth-service', 'storage-service', 'analytics-service'];
    const servicesInfo: Record<string, any> = {};
    let isDegraded = false;
    let isUnhealthy = false;

    for (const service of servicesList) {
      const state = this.circuitBreakerService.getBreakerState(service);
      
      const baseUrlKey = `${service.split('-')[0].toUpperCase()}_SERVICE_URL`;
      const baseUrl = this.configService.get(baseUrlKey) || `http://localhost:300${servicesList.indexOf(service) + 1}`;
      
      let serviceStatus = 'up';
      let latency = -1;
      
      const start = Date.now();
      try {
        const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
        latency = Date.now() - start;
        if (!res.ok) {
          serviceStatus = 'down';
          isDegraded = true;
        }
      } catch (err) {
        serviceStatus = 'down';
        isDegraded = true;
        latency = Date.now() - start;
      }

      if (state === 'OPEN' || state === 'HALF_OPEN') {
        serviceStatus = 'degraded';
        isDegraded = true;
      }

      servicesInfo[service] = {
        status: serviceStatus,
        circuitState: state,
        latencyMs: latency
      };
    }

    const kafkaReady = true; // In a real scenario, check kafka producer status
    
    return {
      status: isUnhealthy ? 'unhealthy' : isDegraded ? 'degraded' : 'healthy',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      services: servicesInfo,
      kafka: { status: kafkaReady ? 'connected' : 'disconnected', producerReady: kafkaReady },
      timestamp: new Date().toISOString()
    };
  }

  @Get('ready')
  ready() {
    return { status: 'ready' };
  }

  @Get('live')
  live() {
    return { status: 'live' };
  }
}

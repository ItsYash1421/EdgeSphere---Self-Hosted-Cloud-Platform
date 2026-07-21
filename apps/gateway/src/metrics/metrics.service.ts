import { Injectable } from '@nestjs/common';
import * as promClient from 'prom-client';

@Injectable()
export class MetricsService {
  private requestsTotal: promClient.Counter;
  private requestDuration: promClient.Histogram;
  private rateLimitHitsTotal: promClient.Counter;
  private upstreamErrorsTotal: promClient.Counter;

  constructor() {
    promClient.collectDefaultMetrics();

    this.requestsTotal = new promClient.Counter({
      name: 'gateway_requests_total',
      help: 'Total number of requests through gateway',
      labelNames: ['method', 'path', 'status', 'service'],
    });

    this.requestDuration = new promClient.Histogram({
      name: 'gateway_request_duration_seconds',
      help: 'Histogram of gateway request duration',
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
    });

    this.rateLimitHitsTotal = new promClient.Counter({
      name: 'gateway_rate_limit_hits_total',
      help: 'Total number of rate limit rejections',
      labelNames: ['algorithm'],
    });

    this.upstreamErrorsTotal = new promClient.Counter({
      name: 'gateway_upstream_errors_total',
      help: 'Total number of upstream errors',
      labelNames: ['service'],
    });
  }

  recordRequest(method: string, path: string, status: string, service: string) {
    this.requestsTotal.labels(method, path, status, service).inc();
    if (status.startsWith('5')) {
      this.upstreamErrorsTotal.labels(service).inc();
    }
  }

  recordLatency(seconds: number) {
    this.requestDuration.observe(seconds);
  }

  recordRateLimitHit(algorithm: string) {
    this.rateLimitHitsTotal.labels(algorithm).inc();
  }

  async getMetrics(): Promise<string> {
    return promClient.register.metrics();
  }
}

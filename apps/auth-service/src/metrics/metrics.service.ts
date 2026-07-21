import { Injectable } from '@nestjs/common';
import { Registry, Counter } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  public readonly authRequestsTotal: Counter<string>;
  public readonly authLoginsTotal: Counter<string>;
  public readonly authFailuresTotal: Counter<string>;

  constructor() {
    this.registry = new Registry();

    this.authRequestsTotal = new Counter({
      name: 'auth_requests_total',
      help: 'Total number of auth requests',
      registers: [this.registry],
    });

    this.authLoginsTotal = new Counter({
      name: 'auth_logins_total',
      help: 'Total number of successful logins',
      registers: [this.registry],
    });

    this.authFailuresTotal = new Counter({
      name: 'auth_failures_total',
      help: 'Total number of failed auth attempts',
      registers: [this.registry],
    });
  }

  getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}

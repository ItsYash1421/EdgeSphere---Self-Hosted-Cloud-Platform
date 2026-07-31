import { Injectable, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: client.Registry;

  constructor() {
    this.registry = new client.Registry();
  }

  onModuleInit() {
    client.collectDefaultMetrics({ register: this.registry });

    new client.Counter({
      name: 'analytics_events_ingested_total',
      help: 'Total number of events ingested',
      labelNames: ['topic'],
      registers: [this.registry],
    });

    new client.Histogram({
      name: 'analytics_query_duration_seconds',
      help: 'Duration of analytics queries in seconds',
      labelNames: ['query_type'],
      registers: [this.registry],
    });

    new client.Gauge({
      name: 'analytics_kafka_consumer_lag',
      help: 'Kafka consumer lag for analytics',
      registers: [this.registry],
    });

    new client.Histogram({
      name: 'analytics_batch_size',
      help: 'Size of batches processed by analytics consumer',
      registers: [this.registry],
    });
  }

  getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
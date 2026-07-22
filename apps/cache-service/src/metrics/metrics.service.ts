import { Injectable } from '@nestjs/common';
import * as promClient from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: promClient.Registry;
  private readonly purgeOperationsTotal: promClient.Counter;
  private readonly purgeKeysDeletedTotal: promClient.Counter;
  private readonly purgeDurationSeconds: promClient.Histogram;

  constructor() {
    this.registry = new promClient.Registry();
    promClient.collectDefaultMetrics({ register: this.registry });

    this.purgeOperationsTotal = new promClient.Counter({
      name: 'cache_purge_operations_total',
      help: 'Total number of purge operations',
      labelNames: ['type'],
      registers: [this.registry],
    });

    this.purgeKeysDeletedTotal = new promClient.Counter({
      name: 'cache_purge_keys_deleted_total',
      help: 'Total number of keys deleted in purge operations',
      registers: [this.registry],
    });

    this.purgeDurationSeconds = new promClient.Histogram({
      name: 'cache_purge_duration_seconds',
      help: 'Duration of purge operations',
      registers: [this.registry],
    });
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  recordPurgeOperation(type: 'file' | 'bucket' | 'prefix' | 'all', durationSeconds: number, keysDeleted: number) {
    this.purgeOperationsTotal.labels(type).inc();
    this.purgeDurationSeconds.observe(durationSeconds);
    this.purgeKeysDeletedTotal.inc(keysDeleted);
  }
}

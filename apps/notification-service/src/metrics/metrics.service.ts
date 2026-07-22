import { Injectable } from '@nestjs/common';
import * as promClient from 'prom-client';

@Injectable()
export class MetricsService {
  public notificationsSentTotal: promClient.Counter<string>;
  public notificationsFailedTotal: promClient.Counter<string>;
  public alertsTriggeredTotal: promClient.Counter<string>;
  public alertCheckDurationSeconds: promClient.Histogram<string>;

  constructor() {
    promClient.collectDefaultMetrics();

    this.notificationsSentTotal = new promClient.Counter({
      name: 'notifications_sent_total',
      help: 'Total notifications sent',
      labelNames: ['channel'],
    });

    this.notificationsFailedTotal = new promClient.Counter({
      name: 'notifications_failed_total',
      help: 'Total notifications failed',
      labelNames: ['channel'],
    });

    this.alertsTriggeredTotal = new promClient.Counter({
      name: 'alerts_triggered_total',
      help: 'Total alerts triggered',
      labelNames: ['rule_name', 'condition'],
    });

    this.alertCheckDurationSeconds = new promClient.Histogram({
      name: 'alert_check_duration_seconds',
      help: 'Duration of alert checks in seconds',
      buckets: [0.1, 0.5, 1, 2, 5],
    });
  }

  getMetrics() {
    return promClient.register.metrics();
  }
}

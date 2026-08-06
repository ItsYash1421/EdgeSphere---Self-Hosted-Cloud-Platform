import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AlertRule, DEFAULT_ALERT_RULES } from './alert-rule';
import { NotificationsService } from '../notifications/notifications.service';
import { MetricsService } from '../metrics/metrics.service';
import { v4 as uuidv4 } from 'uuid';

export interface AlertRecord {
  id: string;
  ruleId: string;
  ruleName: string;
  condition: string;
  threshold: number;
  currentValue: number;
  message: string;
  timestamp: Date;
}

@Injectable()
export class AlertsService implements OnModuleInit, OnModuleDestroy {
  private rules: AlertRule[] = [...DEFAULT_ALERT_RULES];
  private history: AlertRecord[] = [];
  private lastTriggered: Map<string, number> = new Map();
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    private configService: ConfigService,
    private notificationsService: NotificationsService,
    private metricsService: MetricsService,
  ) {}

  onModuleInit() {
    const intervalSeconds = this.configService.get<number>('ALERT_CHECK_INTERVAL_SECONDS') || 60;
    this.intervalId = setInterval(() => this.checkAlerts(), intervalSeconds * 1000);
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  async checkAlerts(): Promise<void> {
    const timer = this.metricsService.alertCheckDurationSeconds.startTimer();
    const analyticsUrl = this.configService.get<string>('ANALYTICS_SERVICE_URL') || 'http://localhost:3003';
    const debounceMinutes = this.configService.get<number>('ALERT_DEBOUNCE_MINUTES') || 10;
    const now = Date.now();

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      const lastTime = this.lastTriggered.get(rule.id) || 0;
      if (now - lastTime < debounceMinutes * 60 * 1000) {
        continue;
      }

      try {
        const response = await axios.get(`${analyticsUrl}/analytics/summary?window=${rule.windowMinutes}`);
        const stats = response.data;
        const result = this.evaluateCondition(rule, stats);

        if (result.triggered) {
          const alertRecord: AlertRecord = {
            id: uuidv4(),
            ruleId: rule.id,
            ruleName: rule.name,
            condition: rule.condition,
            threshold: rule.threshold,
            currentValue: result.value,
            message: result.message,
            timestamp: new Date(),
          };

          this.history.unshift(alertRecord);
          if (this.history.length > 50) this.history.pop();

          this.lastTriggered.set(rule.id, now);
          this.metricsService.alertsTriggeredTotal.labels(rule.name, rule.condition).inc();

          await this.notificationsService.dispatch(alertRecord, rule.channels);
        }
      } catch (error) {
        console.error(`Error checking alert rule ${rule.name}:`, error);
      }
    }
    timer();
  }

  evaluateCondition(rule: AlertRule, stats: any): { triggered: boolean; value: number; message: string } {
    let triggered = false;
    let value = 0;
    let message = '';

    switch (rule.condition) {
      case 'error_rate_above':
        value = stats.errorRate || 0;
        triggered = value > rule.threshold;
        message = `Error rate is ${value}%, above threshold of ${rule.threshold}%`;
        break;
      case 'latency_above':
        value = stats.avgLatency || 0;
        triggered = value > rule.threshold;
        message = `Average latency is ${value}ms, above threshold of ${rule.threshold}ms`;
        break;
      case 'cache_hit_below':
        value = stats.cacheHitRate || 100;
        triggered = value < rule.threshold;
        message = `Cache hit rate is ${value}%, below threshold of ${rule.threshold}%`;
        break;
      case 'bandwidth_above':
        value = stats.bandwidthUsage || 0;
        triggered = value > rule.threshold;
        message = `Bandwidth usage is ${value} bytes, above threshold of ${rule.threshold} bytes`;
        break;
      case 'edge_down':
        value = stats.activeEdges || 1;
        triggered = value <= rule.threshold;
        message = `Active edges is ${value}, equal or below threshold of ${rule.threshold}`;
        break;
    }

    return { triggered, value, message };
  }

  getAlertHistory(page = 1, pageSize = 20) {
    const total = this.history.length;
    const start = (page - 1) * pageSize;
    const data = this.history.slice(start, start + pageSize);
    return { data, total, page, pageSize };
  }

  createRule(rule: Partial<AlertRule>): AlertRule {
    const newRule: AlertRule = {
      id: uuidv4(),
      name: rule.name || 'New Rule',
      condition: rule.condition || 'error_rate_above',
      threshold: rule.threshold || 0,
      windowMinutes: rule.windowMinutes || 5,
      channels: rule.channels || ['webhook'],
      enabled: rule.enabled ?? true,
    };
    this.rules.push(newRule);
    return newRule;
  }

  updateRule(id: string, updates: Partial<AlertRule>): AlertRule {
    const index = this.rules.findIndex((r) => r.id === id);
    if (index === -1) throw new Error('Rule not found');
    this.rules[index] = { ...this.rules[index], ...updates };
    return this.rules[index];
  }

  deleteRule(id: string): void {
    this.rules = this.rules.filter((r) => r.id !== id);
  }

  listRules(page = 1, pageSize = 20) {
    const total = this.rules.length;
    const start = (page - 1) * pageSize;
    const data = this.rules.slice(start, start + pageSize);
    return { data, total, page, pageSize };
  }
}

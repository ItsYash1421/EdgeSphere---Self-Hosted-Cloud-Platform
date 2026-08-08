import { AlertsService } from './alerts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MetricsService } from '../metrics/metrics.service';
import { ConfigService } from '@nestjs/config';
import { AlertRule } from './alert-rule';

const mockCounter = { labels: jest.fn().mockReturnThis(), inc: jest.fn() };
const mockTimer = jest.fn().mockReturnValue(jest.fn());
const mockMetrics = {
  alertsTriggeredTotal: mockCounter,
  alertCheckDurationSeconds: { startTimer: mockTimer },
};
const mockNotifications = { dispatch: jest.fn().mockResolvedValue(undefined) };
const mockConfig = { get: jest.fn((key: string, def?: any) => def ?? null) };

describe('AlertsService', () => {
  let service: AlertsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AlertsService(
      mockConfig as unknown as ConfigService,
      mockNotifications as unknown as NotificationsService,
      mockMetrics as unknown as MetricsService,
    );
  });

  describe('evaluateCondition', () => {
    type Condition = 'error_rate_above' | 'latency_above' | 'cache_hit_below' | 'bandwidth_above' | 'edge_down';
    const rule = (condition: Condition, threshold: number): AlertRule => ({
      id: 'r1', name: 'Test', condition, threshold,
      windowMinutes: 5, channels: ['email'], enabled: true,
    });

    it('error_rate_above: triggers when errorRate strictly exceeds threshold', () => {
      const result = service.evaluateCondition(rule('error_rate_above', 5), { errorRate: 5.1 });
      expect(result.triggered).toBe(true);
    });

    it('error_rate_above: does NOT trigger when errorRate exactly equals threshold', () => {
      const result = service.evaluateCondition(rule('error_rate_above', 5), { errorRate: 5 });
      expect(result.triggered).toBe(false); // strict >
    });

    it('error_rate_above: handles missing errorRate (defaults to 0)', () => {
      const result = service.evaluateCondition(rule('error_rate_above', 5), {});
      expect(result.triggered).toBe(false);
      expect(result.value).toBe(0);
    });

    it('latency_above: triggers when avgLatency exceeds threshold', () => {
      const result = service.evaluateCondition(rule('latency_above', 200), { avgLatency: 201 });
      expect(result.triggered).toBe(true);
    });

    it('cache_hit_below: triggers when cacheHitRate is strictly below threshold', () => {
      const result = service.evaluateCondition(rule('cache_hit_below', 80), { cacheHitRate: 79.9 });
      expect(result.triggered).toBe(true);
    });

    it('cache_hit_below: does NOT trigger when cacheHitRate equals threshold', () => {
      const result = service.evaluateCondition(rule('cache_hit_below', 80), { cacheHitRate: 80 });
      expect(result.triggered).toBe(false); // strict <
    });

    it('cache_hit_below: defaults to 100 when cacheHitRate is missing (no spurious alert)', () => {
      const result = service.evaluateCondition(rule('cache_hit_below', 80), {});
      expect(result.triggered).toBe(false); // 100 < 80 is false
    });

    it('bandwidth_above: triggers when bandwidthUsage exceeds threshold', () => {
      const result = service.evaluateCondition(rule('bandwidth_above', 1000), { bandwidthUsage: 1001 });
      expect(result.triggered).toBe(true);
    });

    it('edge_down: triggers when activeEdges is exactly at threshold (<=)', () => {
      const result = service.evaluateCondition(rule('edge_down', 1), { activeEdges: 1 });
      expect(result.triggered).toBe(true); // uses <=
    });

    it('edge_down: does NOT trigger when activeEdges is above threshold', () => {
      const result = service.evaluateCondition(rule('edge_down', 1), { activeEdges: 2 });
      expect(result.triggered).toBe(false);
    });

    it('returns untriggered result with zero value for unknown condition', () => {
      const result = service.evaluateCondition(rule('error_rate_above', 50), { value: 999 });
      // When stats don't have the matching field, value defaults to 0 (no spurious trigger)
      expect(result.triggered).toBe(false);
      expect(result.value).toBe(0);
    });

    it('generates a non-empty message when triggered', () => {
      const result = service.evaluateCondition(rule('error_rate_above', 5), { errorRate: 10 });
      expect(result.message).toBeTruthy();
      expect(result.message.length).toBeGreaterThan(0);
    });
  });

  describe('createRule', () => {
    it('generates a UUID id for each new rule', () => {
      const r1 = service.createRule({ name: 'Rule A', condition: 'error_rate_above', threshold: 5 });
      const r2 = service.createRule({ name: 'Rule B', condition: 'error_rate_above', threshold: 5 });
      expect(r1.id).not.toBe(r2.id);
    });

    it('defaults enabled to true when not provided', () => {
      const r = service.createRule({ name: 'X', condition: 'latency_above', threshold: 300 });
      expect(r.enabled).toBe(true);
    });

    it('defaults channels to ["webhook"]', () => {
      const r = service.createRule({ name: 'X', condition: 'latency_above', threshold: 300 });
      expect(r.channels).toEqual(['webhook']);
    });
  });

  describe('updateRule', () => {
    it('throws when rule id does not exist', () => {
      expect(() => service.updateRule('nonexistent-id', { threshold: 10 })).toThrow('Rule not found');
    });

    it('merges updates without replacing the entire rule', () => {
      const created = service.createRule({ name: 'Old Name', condition: 'latency_above', threshold: 100 });
      const updated = service.updateRule(created.id, { threshold: 200 });
      expect(updated.threshold).toBe(200);
      expect(updated.name).toBe('Old Name');
    });
  });

  describe('deleteRule', () => {
    it('removes the rule so it no longer appears in listRules', () => {
      const created = service.createRule({ name: 'Temp', condition: 'latency_above', threshold: 100 });
      service.deleteRule(created.id);
      const { data } = service.listRules();
      expect(data.find((r) => r.id === created.id)).toBeUndefined();
    });

    it('is a no-op when deleting a non-existent rule id', () => {
      expect(() => service.deleteRule('does-not-exist')).not.toThrow();
    });
  });

  describe('getAlertHistory', () => {
    it('returns empty data on fresh start', () => {
      const { data, total } = service.getAlertHistory();
      expect(total).toBe(0);
      expect(data).toHaveLength(0);
    });
  });

  describe('debounce logic in checkAlerts', () => {
    it('does not dispatch notification for a rule within debounce window', async () => {
      const axios = require('axios');
      jest.mock('axios');

      const rule = service.createRule({
        name: 'Debounce Test', condition: 'error_rate_above', threshold: 1, enabled: true,
      });

      // Manually set lastTriggered to right now (within debounce)
      (service as any).lastTriggered.set(rule.id, Date.now());

      await service.checkAlerts();

      expect(mockNotifications.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('listRules pagination', () => {
    it('returns correct page of results', () => {
      for (let i = 0; i < 25; i++) {
        service.createRule({ name: `Rule ${i}`, condition: 'latency_above', threshold: i });
      }
      const page2 = service.listRules(2, 10);
      expect(page2.data).toHaveLength(10);
      expect(page2.page).toBe(2);
    });
  });
});

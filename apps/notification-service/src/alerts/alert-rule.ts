export interface AlertRule {
  id: string;
  name: string;
  condition: 'error_rate_above' | 'latency_above' | 'cache_hit_below' | 'bandwidth_above' | 'edge_down';
  threshold: number;
  windowMinutes: number;
  channels: ('email' | 'webhook' | 'slack')[];
  enabled: boolean;
}

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  { id: '1', name: 'High Error Rate', condition: 'error_rate_above', threshold: 5, windowMinutes: 5, channels: ['webhook'], enabled: true },
  { id: '2', name: 'High Latency', condition: 'latency_above', threshold: 500, windowMinutes: 5, channels: ['webhook'], enabled: true },
  { id: '3', name: 'Low Cache Hit', condition: 'cache_hit_below', threshold: 50, windowMinutes: 15, channels: ['webhook'], enabled: true },
  { id: '4', name: 'Edge Server Down', condition: 'edge_down', threshold: 0, windowMinutes: 1, channels: ['email', 'webhook'], enabled: true },
];

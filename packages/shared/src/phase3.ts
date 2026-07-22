/**
 * Phase 3 — Kafka Event Types & DTOs
 * Used by: gateway, cdn-service, analytics-service, notification-service
 */

// ─── Kafka Topics ─────────────────────────────────────────────────────────────

export const KAFKA_TOPICS = {
  REQUEST_EVENTS: 'request.events',
  STORAGE_EVENTS: 'storage.events',
  ALERTS_TRIGGERED: 'alerts.triggered',
  SYSTEM_EVENTS: 'system.events',
} as const;

export type KafkaTopic = typeof KAFKA_TOPICS[keyof typeof KAFKA_TOPICS];

// ─── Request Event (published by gateway + CDN after every request) ───────────

export interface RequestEventDto {
  time: string;            // ISO 8601
  service: string;         // 'gateway' | 'cdn-service-a' | 'cdn-service-b' | 'storage-service'
  method: string;          // GET | POST | PUT | DELETE | HEAD
  path: string;            // e.g. /cdn/my-bucket/image.jpg
  status: number;          // HTTP status code
  latencyMs: number;       // end-to-end ms
  userId?: string;         // from JWT payload (null for CDN public)
  ip: string;              // client IP
  country?: string;        // 2-letter ISO (simulated from IP for now)
  cacheHit: boolean;       // X-Cache: HIT
  bytes: number;           // response Content-Length
  edgeRegion?: string;     // us-east-1 | eu-west-1 | ap-south-1
  requestId: string;       // UUID
  userAgent?: string;      // User-Agent header
  referer?: string;        // Referer header
}

// ─── Storage Event (published by storage-service) ─────────────────────────────

export type StorageEventType =
  | 'bucket.created' | 'bucket.deleted'
  | 'file.uploaded' | 'file.downloaded' | 'file.deleted'
  | 'presign.generated';

export interface StorageEventDto {
  time: string;
  type: StorageEventType;
  userId: string;
  bucket: string;
  key?: string;            // for file events
  sizeBytes?: number;      // for upload events
  contentType?: string;    // for upload events
  requestId: string;
}

// ─── Alert Event (published by notification-service) ──────────────────────────

export type AlertCondition =
  | 'error_rate_above'
  | 'latency_above'
  | 'cache_hit_below'
  | 'bandwidth_above'
  | 'edge_down'
  | 'quota_exceeded';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AlertTriggeredDto {
  alertId: string;
  ruleName: string;
  condition: AlertCondition;
  threshold: number;
  currentValue: number;
  severity: AlertSeverity;
  message: string;
  channels: string[];
  timestamp: string;
}

// ─── System Event (for edge-down, deployments etc) ───────────────────────────

export type SystemEventType =
  | 'edge.down' | 'edge.up' | 'edge.degraded'
  | 'cache.purged' | 'service.restarted'
  | 'quota.exceeded';

export interface SystemEventDto {
  time: string;
  type: SystemEventType;
  service: string;
  region?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

// ─── Analytics Query Response Types ──────────────────────────────────────────

export interface TimeSeriesPoint {
  t: string;          // ISO timestamp
  value: number;
}

export interface SummaryStats {
  totalRequests: number;
  cacheHitRatio: number;   // 0-100
  avgLatency: number;      // ms
  p95Latency: number;      // ms
  totalBandwidthBytes: number;
  errorRate: number;       // 0-100
  activeUsers: number;
  windowMinutes: number;
  generatedAt: Date;
}

export interface LatencyPercentiles {
  p50: number;
  p95: number;
  p99: number;
}

export interface GeoDataPoint {
  country: string;     // 2-letter ISO
  count: number;
  pct: number;         // percentage 0-100
}

export interface TopPath {
  path: string;
  count: number;
  avgLatency: number;
}

export interface ServiceStats {
  service: string;
  count: number;
  errorCount: number;
}

// ─── Notification Types ───────────────────────────────────────────────────────

export type NotificationChannel = 'email' | 'webhook' | 'slack';
export type NotificationStatus = 'sent' | 'failed' | 'pending';

export interface AlertRule {
  id: string;
  name: string;
  condition: AlertCondition;
  threshold: number;
  windowMinutes: number;
  channels: NotificationChannel[];
  enabled: boolean;
  severity: AlertSeverity;
  createdAt: Date;
}

export interface AlertRecord {
  id: string;
  ruleId: string;
  ruleName: string;
  condition: AlertCondition;
  threshold: number;
  currentValue: number;
  severity: AlertSeverity;
  message: string;
  triggeredAt: Date;
  resolvedAt?: Date;
}

export interface NotificationRecord {
  id: string;
  alertId: string;
  channel: NotificationChannel;
  recipient: string;
  status: NotificationStatus;
  message: string;
  sentAt: Date;
  error?: string;
}

export interface AlertWebhookPayload {
  alertId: string;
  ruleName: string;
  condition: AlertCondition;
  threshold: number;
  currentValue: number;
  severity: AlertSeverity;
  message: string;
  timestamp: string;
  dashboardUrl: string;
}

// ─── IP to Country Mapping (simulated) ────────────────────────────────────────
// Maps first IP octet range to country code for local dev simulation

export function simulateCountryFromIp(ip: string): string {
  const firstOctet = parseInt(ip.split('.')[0] || '0', 10);
  if (firstOctet <= 50)  return 'IN'; // India
  if (firstOctet <= 100) return 'US'; // United States
  if (firstOctet <= 130) return 'DE'; // Germany
  if (firstOctet <= 160) return 'GB'; // United Kingdom
  if (firstOctet <= 190) return 'JP'; // Japan
  if (firstOctet <= 220) return 'AU'; // Australia
  return 'CA';                        // Canada
}

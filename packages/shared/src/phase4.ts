/**
 * Phase 4 — Resilience, WebSocket, OAuth2, Multipart Upload types
 */

// ─── Circuit Breaker ──────────────────────────────────────────────────────────

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitStats {
  successCount: number;
  failureCount: number;
  rejectCount: number;    // rejected while OPEN
  fallbackCount: number;
  totalCount: number;
  errorPercentage: number;
}

export interface CircuitBreakerStatus {
  service: string;
  state: CircuitState;
  stats: CircuitStats;
  lastStateChange: Date;
  nextAttemptAt?: Date;   // when OPEN, next half-open probe
}

// ─── DLQ (Dead Letter Queue) ──────────────────────────────────────────────────

export interface DlqMessage {
  id: string;
  originalTopic: string;
  originalMessage: unknown;
  error: string;
  attempt: number;        // 0 = first fail, 1 = first retry, etc.
  maxAttempts: number;    // default 3
  timestamp: string;
  retryAfter: string;     // ISO timestamp for next retry
  permanent?: boolean;    // true if all retries exhausted
}

export const DLQ_RETRY_DELAYS_MS = [
  30_000,       // 30s
  300_000,      // 5min
  1_800_000,    // 30min
] as const;

// ─── WebSocket Real-time Types ────────────────────────────────────────────────

export type WsRoom = 'metrics' | 'events' | 'alerts' | 'cdn' | 'storage';

export interface RealtimeMetrics {
  requestsPerSec: number;
  cacheHitRatio: number;    // 0-100
  avgLatencyMs: number;
  p95LatencyMs: number;
  activeConnections: number;
  errorRate: number;        // 0-100
  bandwidthBytesPerSec: number;
  timestamp: string;
}

export interface WsConnectPayload {
  clientId: string;
  timestamp: string;
  subscribedRooms: WsRoom[];
  serverVersion: string;
}

export interface WsSubscribePayload {
  rooms: WsRoom[];
}

// ─── OAuth2 Types ─────────────────────────────────────────────────────────────

export type OAuthProvider = 'google' | 'github' | 'local';

export interface OAuthProfile {
  providerId: string;
  provider: OAuthProvider;
  email: string;
  displayName: string;
  avatar?: string;
  emailVerified: boolean;
}

export interface OAuthCallbackResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    avatar?: string;
    provider: OAuthProvider;
  };
  isNewUser: boolean;
}

// ─── Multipart Upload Types ───────────────────────────────────────────────────

export const MULTIPART_PART_SIZE = 5 * 1024 * 1024; // 5MB

export interface MultipartUploadSession {
  uploadId: string;
  bucketName: string;
  key: string;
  userId: string;
  contentType: string;
  totalSize: number;
  partCount: number;
  completedParts: CompletedPart[];
  createdAt: string;
  expiresAt: string;
  status: 'in_progress' | 'completed' | 'aborted';
}

export interface CompletedPart {
  partNumber: number;
  etag: string;
  size: number;           // bytes
  uploadedAt: string;
}

export interface InitiateUploadResponse {
  uploadId: string;
  partCount: number;
  partSize: number;       // bytes per part (5MB)
  expiresAt: Date;
  uploadUrls?: string[];  // presigned URLs for each part (optional)
}

export interface UploadPartResponse {
  partNumber: number;
  etag: string;
  uploadedBytes: number;
}

export interface UploadStatus {
  uploadId: string;
  key: string;
  totalSize: number;
  completedParts: number;
  totalParts: number;
  progress: number;       // 0-100
  uploadedBytes: number;
  expiresAt: Date;
  status: 'in_progress' | 'completed' | 'aborted';
}

// ─── Enhanced Health Check Types ──────────────────────────────────────────────

export type ServiceHealthStatus = 'up' | 'down' | 'degraded';

export interface ServiceHealthInfo {
  status: ServiceHealthStatus;
  circuitState?: CircuitState;
  latencyMs?: number;
  lastChecked: string;
  error?: string;
}

export interface GatewayHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  services: Record<string, ServiceHealthInfo>;
  kafka: {
    status: 'connected' | 'disconnected';
    producerReady: boolean;
  };
  timestamp: string;
  version: string;
}

// ─── Rate Limit Headers (RFC 6585) ───────────────────────────────────────────

export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  'Retry-After'?: string;  // only on 429
}

// ─── Helper: compute part count for file size ─────────────────────────────────

export function computePartCount(totalSizeBytes: number): number {
  if (totalSizeBytes <= MULTIPART_PART_SIZE) return 1;
  return Math.ceil(totalSizeBytes / MULTIPART_PART_SIZE);
}

export function getPartRange(partNumber: number, totalSize: number): { start: number; end: number; size: number } {
  const start = (partNumber - 1) * MULTIPART_PART_SIZE;
  const end = Math.min(partNumber * MULTIPART_PART_SIZE, totalSize);
  return { start, end, size: end - start };
}

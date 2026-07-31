/**
 * @edgesphere/shared
 * Shared types, interfaces, DTOs, and constants across all EdgeSphere services.
 */

// Phase 2 — CDN, Image Optimization, Cache Invalidation
export * from './phase2';

// Phase 3 — Kafka Events, Analytics DTOs, Notification Types
export * from './phase3';

// Phase 4 — Circuit Breaker, DLQ, WebSocket, OAuth2, Multipart Upload
export * from './phase4';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const UserRole = {
  ADMIN: 'admin',
  USER: 'user',
  VIEWER: 'viewer',
} as const;
export type UserRole = typeof UserRole[keyof typeof UserRole];

export const EventTopic = {
  AUTH_EVENTS: 'auth-events',
  STORAGE_EVENTS: 'storage-events',
  REQUEST_EVENTS: 'request-events',
  CACHE_INVALIDATION: 'cache-invalidation',
  NOTIFICATION_EVENTS: 'notification-events',
} as const;
export type EventTopic = typeof EventTopic[keyof typeof EventTopic];

export const CacheRegion = {
  US_EAST_1: 'us-east-1',
  EU_WEST_1: 'eu-west-1',
  AP_SOUTH_1: 'ap-south-1',
} as const;
export type CacheRegion = typeof CacheRegion[keyof typeof CacheRegion];

export const HttpMethod = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
} as const;
export type HttpMethod = typeof HttpMethod[keyof typeof HttpMethod];

// ─── JWT ──────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;      // userId
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;  // seconds
}

// ─── API Response Wrappers ────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  requestId?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;   // first 8 chars of key for display
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

export interface Bucket {
  id: string;
  userId: string;
  name: string;
  region: string;
  isPublic: boolean;
  objectCount: number;
  totalSize: number;   // bytes
  createdAt: Date;
}

export interface FileObject {
  id: string;
  bucketId: string;
  key: string;
  size: number;        // bytes
  contentType: string;
  etag: string;
  version: number;
  cdnUrl?: string;
  presignedUrl?: string;
  expiresAt?: Date;
  createdAt: Date;
}

export interface PresignedUrl {
  url: string;
  expiresAt: Date;
  method: 'GET' | 'PUT';
  headers?: Record<string, string>;
}

export interface MultipartUploadPart {
  partNumber: number;
  etag: string;
  size: number;
}

// ─── CDN / Cache ──────────────────────────────────────────────────────────────

export interface CacheEntry {
  key: string;
  region: CacheRegion;
  bucket: string;
  fileKey: string;
  ttl: number;          // seconds
  hits: number;
  size: number;         // bytes
  contentType: string;
  transformParams?: ImageTransformParams;
  createdAt: Date;
  expiresAt: Date;
}

export interface ImageTransformParams {
  width?: number;
  height?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  quality?: number;       // 1-100
  fit?: 'cover' | 'contain' | 'fill';
}

export interface CacheInvalidationEvent {
  bucket: string;
  key?: string;         // null = purge entire bucket
  regions?: CacheRegion[];
  requestedBy: string;
  requestedAt: Date;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface RequestEvent {
  service: string;
  method: HttpMethod;
  path: string;
  status: number;
  latencyMs: number;
  userId?: string;
  ip: string;
  country?: string;
  cacheHit: boolean;
  bytes: number;
  edgeRegion?: CacheRegion;
  timestamp: Date;
}

export interface AnalyticsOverview {
  totalRequests: number;
  totalBandwidth: number;     // bytes
  cacheHitRatio: number;      // 0-1
  avgLatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;          // 0-1
  activeUsers: number;
  storageUsed: number;        // bytes
}

export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
}

// ─── Kafka Events ─────────────────────────────────────────────────────────────

export interface KafkaMessage<T = unknown> {
  eventId: string;
  eventType: string;
  topic: EventTopic;
  payload: T;
  timestamp: Date;
  source: string;      // service name
  version: string;     // schema version
}

// ─── Notifications ────────────────────────────────────────────────────────────

export const NotificationChannel = {
  EMAIL: 'email',
  WEBHOOK: 'webhook',
  SLACK: 'slack',
  DISCORD: 'discord',
} as const;
export type NotificationChannel = typeof NotificationChannel[keyof typeof NotificationChannel];

export const NotificationTrigger = {
  STORAGE_QUOTA_EXCEEDED: 'storage.quota.exceeded',
  TRAFFIC_SPIKE: 'traffic.spike',
  EDGE_SERVER_DOWN: 'edge.server.down',
  CACHE_PURGE_COMPLETE: 'cache.purge.complete',
  UPLOAD_COMPLETE: 'upload.complete',
  HIGH_ERROR_RATE: 'error.rate.high',
} as const;
export type NotificationTrigger = typeof NotificationTrigger[keyof typeof NotificationTrigger];

export interface NotificationEvent {
  trigger: NotificationTrigger;
  userId: string;
  channels: NotificationChannel[];
  data: Record<string, unknown>;
  timestamp: Date;
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterMs?: number;
}

export interface RateLimitConfig {
  windowMs: number;     // time window in ms
  max: number;          // max requests per window
  keyPrefix: string;    // redis key prefix
  algorithm: 'token-bucket' | 'sliding-window' | 'fixed-window';
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export const ErrorCode = {
  // Auth
  INVALID_CREDENTIALS: 'AUTH_001',
  TOKEN_EXPIRED: 'AUTH_002',
  TOKEN_INVALID: 'AUTH_003',
  INSUFFICIENT_PERMISSIONS: 'AUTH_004',
  API_KEY_INVALID: 'AUTH_005',

  // Storage
  BUCKET_NOT_FOUND: 'STORAGE_001',
  BUCKET_ALREADY_EXISTS: 'STORAGE_002',
  FILE_NOT_FOUND: 'STORAGE_003',
  FILE_TOO_LARGE: 'STORAGE_004',
  QUOTA_EXCEEDED: 'STORAGE_005',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'GATEWAY_001',

  // General
  VALIDATION_ERROR: 'GENERAL_001',
  INTERNAL_ERROR: 'GENERAL_002',
  SERVICE_UNAVAILABLE: 'GENERAL_003',
} as const;
export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

export interface EdgeSphereError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

// ─── Health Check ─────────────────────────────────────────────────────────────

export interface HealthStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;       // seconds
  checks: {
    name: string;
    status: 'up' | 'down';
    latencyMs?: number;
  }[];
  timestamp: Date;
}

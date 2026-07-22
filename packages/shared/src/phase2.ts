/**
 * @edgesphere/shared — Phase 2 additions
 * Add these to the existing index.ts
 */

// ─── CDN Phase 2 Types ────────────────────────────────────────────────────────

export interface CdnResponse {
  data: Buffer;
  contentType: string;
  etag: string;
  cacheHit: boolean;
  cacheLevel?: 'L1' | 'L2' | 'ORIGIN';
  remainingTTL: number;        // seconds
  originalSize?: number;       // bytes (before transform)
  optimizedSize?: number;      // bytes (after transform)
  region: string;
  transformApplied: boolean;
}

export interface TransformResult {
  data: Buffer;
  contentType: string;
  width?: number;
  height?: number;
  format: string;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;    // optimizedSize / originalSize
}

export interface PurgeResult {
  purgeId: string;
  type: 'file' | 'bucket' | 'prefix' | 'all';
  target: string;
  keysDeleted: number;
  regions: string[];
  durationMs: number;
  timestamp: Date;
}

export interface PurgeRecord extends PurgeResult {
  requestedBy?: string;
}

export interface CacheStats {
  totalKeys: number;
  memoryUsed: string;
  hitCount: number;
  missCount: number;
  hitRatio: number;
  evictedKeys: number;
}

export interface GeoRegion {
  region: string;
  endpoint: string;
  status: 'online' | 'offline' | 'degraded';
  latency?: number;
  cacheHitRatio?: number;
}

// ─── Rate Limit Types ─────────────────────────────────────────────────────────

export interface TokenBucketState {
  tokens: number;
  lastRefill: number;    // Unix timestamp ms
  capacity: number;
  refillRate: number;    // tokens per second
}

export interface SlidingWindowState {
  count: number;
  windowStart: number;
  windowEnd: number;
}

// ─── Image Transform ──────────────────────────────────────────────────────────

export const SUPPORTED_OUTPUT_FORMATS = ['webp', 'avif', 'jpeg', 'png', 'gif'] as const;
export type OutputFormat = typeof SUPPORTED_OUTPUT_FORMATS[number];

export const FIT_OPTIONS = ['cover', 'contain', 'fill', 'inside', 'outside'] as const;
export type FitOption = typeof FIT_OPTIONS[number];

export interface ImageTransformParams {
  width?: number;          // px
  height?: number;         // px
  format?: OutputFormat;
  quality?: number;        // 1-100
  fit?: FitOption;
  blur?: number;           // 0.3-1000
  grayscale?: boolean;
}

// ─── Cache Headers ────────────────────────────────────────────────────────────

export interface CacheHeaders {
  'X-Cache': 'HIT' | 'MISS';
  'X-Cache-Level'?: 'L1' | 'L2' | 'ORIGIN';
  'X-Edge-Region': string;
  'X-Cache-TTL'?: string;
  'Cache-Control': string;
  'ETag': string;
  'Content-Type': string;
  'Content-Length'?: string;
  'Vary'?: string;
}

export function buildCacheHeaders(response: CdnResponse): CacheHeaders {
  return {
    'X-Cache': response.cacheHit ? 'HIT' : 'MISS',
    'X-Cache-Level': response.cacheLevel,
    'X-Edge-Region': response.region,
    'X-Cache-TTL': String(response.remainingTTL),
    'Cache-Control': `public, max-age=${response.remainingTTL}, s-maxage=${response.remainingTTL}`,
    'ETag': `"${response.etag}"`,
    'Content-Type': response.contentType,
    'Content-Length': String(response.data.length),
    'Vary': 'Accept-Encoding, Accept',
  };
}

// ─── Cache Key Builder ────────────────────────────────────────────────────────

export function buildCdnCacheKey(
  region: string,
  bucket: string,
  key: string,
  transforms?: ImageTransformParams,
): string {
  const transformHash = transforms && Object.keys(transforms).length > 0
    ? ':' + Object.entries(transforms)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join(',')
    : '';

  return `cdn:${region}:${bucket}/${key}${transformHash}`;
}

export function buildPurgePattern(bucket: string, key?: string, prefix?: string): string {
  if (key) return `cdn:*:${bucket}/${key}*`;
  if (prefix) return `cdn:*:${bucket}/${prefix}*`;
  return `cdn:*:${bucket}/*`;
}

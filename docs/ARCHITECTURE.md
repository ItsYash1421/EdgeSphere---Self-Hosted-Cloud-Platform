# EdgeSphere — System Architecture

> Living document. Updated after each phase.  
> Version: 1.0.0 | Last Updated: July 2026

---

## 1. C4 Model Overview

### Level 1 — System Context

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Internet                                    │
│                                                                     │
│   ┌──────────┐        ┌──────────────────────────────────────┐      │
│   │  Browser  │───────▶│          EdgeSphere Platform          │      │
│   └──────────┘        │                                      │      │
│   ┌──────────┐        │  • CDN + Edge Serving                │      │
│   │  Mobile  │───────▶│  • Object Storage (S3-compatible)    │      │
│   └──────────┘        │  • API Gateway                       │      │
│   ┌──────────┐        │  • Analytics & Monitoring            │      │
│   │API Client│───────▶│  • Auth & Identity                   │      │
│   └──────────┘        └──────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Level 2 — Container Diagram

```
                              Internet
                                 │
                           DNS / GeoIP
                                 │
                     ┌───────────▼───────────┐
                     │    Nginx Reverse Proxy  │ ← SSL termination, CORS
                     │    (Entry Point)        │   Gzip/Brotli, headers
                     └───────────┬───────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              ▼                  ▼                  ▼
       ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
       │  Edge Srv A  │  │  Edge Srv B  │  │  Edge Srv C  │  ← Go
       │  Redis Cache │  │  Redis Cache │  │  Redis Cache │    Local disk
       └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
              └─────────────────┼─────────────────┘
                                │  (Cache Miss → Origin)
                     ┌──────────▼──────────┐
                     │     API Gateway      │ ← NestJS
                     │  Rate Limit | JWT    │   Prometheus
                     │  Routing | Logging   │   Metrics
                     └──────────┬──────────┘
                                │
      ┌──────────┬──────────────┼──────────────┬─────────────┐
      │          │              │              │             │
      ▼          ▼              ▼              ▼             ▼
 ┌─────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
 │  Auth   │ │Storage │ │Analytics │ │  Cache   │ │Notification  │
 │ Service │ │Service │ │ Service  │ │  Service │ │  Service     │
 └────┬────┘ └───┬────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘
      │          │           │            │              │
      ▼          ▼           ▼            ▼              ▼
 PostgreSQL   MinIO/S3   TimescaleDB   Redis        SMTP/Webhook
              (Buckets)  (Metrics)    Cluster
```

---

## 2. Services Specification

### 2.1 Auth Service

**Language:** TypeScript (NestJS)  
**Port:** 3001  
**Database:** PostgreSQL  
**Cache:** Redis (session blacklist, refresh tokens)

```
Endpoints:
  POST /auth/register       → Create account
  POST /auth/login          → JWT access + refresh token
  POST /auth/refresh        → Rotate refresh token
  POST /auth/logout         → Blacklist refresh token
  GET  /auth/me             → Current user profile
  POST /auth/api-keys       → Create API key
  GET  /auth/api-keys       → List API keys
  DELETE /auth/api-keys/:id → Revoke API key

JWT Payload:
  { sub: userId, email, role, iat, exp }

Refresh Token:
  - Stored in Redis (key: refresh:{token}, value: userId)
  - One-time use (rotation on refresh)
  - 7-day TTL
```

**Database Schema (Auth):**
```sql
users (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR,
  role ENUM('admin','user','viewer'),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

api_keys (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  key_hash VARCHAR NOT NULL,
  name VARCHAR,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP
)
```

---

### 2.2 API Gateway

**Language:** TypeScript (NestJS)  
**Port:** 3000 (public entry)  
**Cache:** Redis  

```
Responsibilities:
  1. JWT / API Key verification (delegated to Auth service)
  2. Rate limiting (per-IP and per-user)
  3. Request routing to microservices
  4. Response caching (GET requests)
  5. Metrics export (Prometheus format)
  6. Request/response logging (structured JSON)
  7. API versioning (/v1/, /v2/)

Rate Limit Algorithms:
  - Token Bucket: for API key rate limits (burst allowed)
  - Sliding Window: for IP-based rate limits (no burst)

Routing Table:
  /v1/auth/*      → auth-service:3001
  /v1/storage/*   → storage-service:3002
  /v1/analytics/* → analytics-service:3003
  /v1/cache/*     → cache-service:3004
  /v1/notifications/* → notification-service:3005
  /config         → gateway (local route, admin-gated PATCH — see §7.2)

Prometheus Metrics:
  http_requests_total{method,path,status,service}
  http_request_duration_seconds{method,path,service}
  rate_limit_hits_total{identifier,algorithm}
  cache_hits_total{path}
  cache_misses_total{path}
```

---

### 2.3 Storage Service

**Language:** TypeScript (NestJS)  
**Port:** 3002  
**Storage Backend:** MinIO  
**Database:** PostgreSQL  

```
Endpoints:
  POST   /v1/storage/buckets          → Create bucket
  GET    /v1/storage/buckets          → List buckets
  DELETE /v1/storage/buckets/:name    → Delete bucket
  POST   /v1/storage/buckets/:name/upload     → Upload file
  GET    /v1/storage/buckets/:name/:key       → Download file
  DELETE /v1/storage/buckets/:name/:key       → Delete file
  GET    /v1/storage/buckets/:name/:key/versions → List versions
  POST   /v1/storage/presigned                → Generate presigned URL
  POST   /v1/storage/multipart/init           → Init multipart upload
  PUT    /v1/storage/multipart/:uploadId/part → Upload part
  POST   /v1/storage/multipart/:uploadId/complete → Complete upload

Database Schema (Storage):
  buckets (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    name VARCHAR UNIQUE NOT NULL,
    region VARCHAR DEFAULT 'us-east-1',
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP
  )

  files (
    id UUID PRIMARY KEY,
    bucket_id UUID REFERENCES buckets(id),
    key VARCHAR NOT NULL,
    size BIGINT,
    content_type VARCHAR,
    etag VARCHAR,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP
  )
```

---

### 2.4 Edge Server

**Language:** Go  
**Port:** 8080 (per edge instance)  
**Cache:** Redis (L1) + Local disk (L2)

```
Cache Hierarchy:
  L1: Redis (hot, shared across threads, ~10GB limit)
  L2: Local disk (warm, persisted, ~100GB limit)
  L3: Origin (cold, fetch from storage-service)

Cache Key Format:
  edge:{region}:{bucket}:{key}:{transform_params_hash}

Cache Flow:
  1. Check L1 (Redis) → HIT: return immediately
  2. Check L2 (disk) → HIT: populate L1, return
  3. Fetch from origin → populate L1+L2, return

Cache Invalidation:
  - Redis pub/sub channel: "cache:invalidate"
  - On purge event: delete from L1 (Redis DEL)
  - On purge event: delete from L2 (os.Remove)
  - Propagates to all edge instances subscribed

Image Optimization (on-the-fly):
  GET /cdn/:bucket/:key?w=400&h=300&fmt=webp&q=80
  → Resize using libvips (Go bindings: govips)
  → Convert to WebP/AVIF
  → Compress at specified quality
  → Cache the transformed version

Metrics exported:
  edge_cache_hits_total
  edge_cache_misses_total
  edge_requests_total
  edge_response_duration_seconds
  edge_bandwidth_bytes_total
```

---

### 2.5 Analytics Service

**Language:** TypeScript (NestJS)  
**Port:** 3003  
**Database:** TimescaleDB (time-series extension on PostgreSQL)  

```
Data Model:
  request_events (
    time        TIMESTAMPTZ NOT NULL,
    service     VARCHAR,
    method      VARCHAR,
    path        VARCHAR,
    status      INTEGER,
    latency_ms  INTEGER,
    user_id     UUID,
    ip          INET,
    country     VARCHAR(2),
    cache_hit   BOOLEAN,
    bytes       BIGINT,
    edge_region VARCHAR
  )

Hypertable partitioned by 'time' (daily chunks)

Aggregation Views:
  requests_per_minute  → COUNT(*) GROUP BY time_bucket('1 minute', time)
  cache_hit_ratio      → AVG(cache_hit::int) GROUP BY time_bucket('5 min', time)
  p95_latency          → percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)
  bandwidth_per_hour   → SUM(bytes) GROUP BY time_bucket('1 hour', time)
  requests_by_country  → COUNT(*) GROUP BY country, time_bucket('1 hour', time)

API Endpoints:
  GET /v1/analytics/overview     → Summary stats (requests, bandwidth, cache ratio)
  GET /v1/analytics/timeseries   → Time series data for charts
  GET /v1/analytics/geo          → Geographic distribution
  GET /v1/analytics/top-files    → Most accessed files
  GET /v1/analytics/errors       → Error rate time series
```

---

### 2.6 Monitoring Stack

```
┌─────────────────────────────────────────────────────────┐
│                   Monitoring Stack                       │
│                                                         │
│   Services ──► Prometheus ──► Grafana (dashboards)      │
│                    │                                     │
│                    └──► Alertmanager ──► Slack/Email     │
│                                                         │
│   Services ──► OpenTelemetry ──► Jaeger (tracing)       │
│                                                         │
│   Services ──► Loki ──► Grafana (log queries)           │
│                                                         │
└─────────────────────────────────────────────────────────┘

Prometheus scrape targets:
  - api-gateway:3000/metrics
  - auth-service:3001/metrics
  - storage-service:3002/metrics
  - analytics-service:3003/metrics
  - edge-server-a:8080/metrics
  - edge-server-b:8081/metrics
  - minio:9000/minio/health/live
  - postgres-exporter:9187/metrics
  - redis-exporter:9121/metrics

Grafana Dashboards:
  1. Platform Overview   (requests, latency, error rate, uptime)
  2. CDN Performance     (cache hit ratio, edge latency, bandwidth)
  3. Storage Metrics     (upload rate, storage growth, bucket stats)
  4. Service Health      (pod status, memory, CPU per service)
  5. Request Logs        (Loki log explorer panel)
```

---

## 3. Data Flow Diagrams

### 3.1 File Upload Flow

```
Client
  │
  ▼
API Gateway (JWT verify, rate limit)
  │
  ▼
Storage Service (validate, generate key)
  │
  ▼
MinIO (store file, return ETag)
  │
  ▼
Storage Service (update DB record)
  │
  ▼
Kafka → analytics-events topic
  │       └── Analytics Service (ingest event)
  │
  ▼
Return 201 { fileId, key, presignedUrl }
```

---

### 3.2 CDN Fetch Flow (Cache Miss → Origin)

```
User Browser
  │
  ▼ GET /cdn/my-bucket/image.jpg?w=400&fmt=webp
DNS (resolve to nearest edge)
  │
  ▼
Edge Server (Go)
  │
  ├─ L1 Cache (Redis)? → HIT → return 200 (X-Cache: HIT)
  │
  ├─ L2 Cache (disk)?  → HIT → populate L1, return 200
  │
  └─ MISS
       │
       ▼
    Storage Service (fetch raw file)
       │
       ▼
    Image Optimizer (resize/convert if params)
       │
       ▼
    Populate L1 + L2
       │
       ▼
    Return 200 (X-Cache: MISS)
       │
       ▼
    Emit metrics event → Kafka → Analytics
```

---

### 3.3 Cache Invalidation Flow

```
Admin Dashboard
  │
  ▼ POST /v1/cache/purge { bucket, key }
API Gateway
  │
  ▼
Cache Service
  │
  ├─ Redis PUBLISH cache:invalidate { bucket, key }
  │
  └─ All Edge Servers (subscribed)
       │
       ├─ Edge A: Redis DEL + disk remove
       ├─ Edge B: Redis DEL + disk remove
       └─ Edge C: Redis DEL + disk remove
            │
            ▼
         Acknowledge → Notification Service → Webhook
```

---

## 4. Infrastructure Layout

### Local Development (Docker Compose)

```
Services:
  nginx          → port 80/443
  api-gateway    → port 3000
  auth-service   → port 3001
  storage-service→ port 3002
  analytics-svc  → port 3003
  edge-server-a  → port 8080
  edge-server-b  → port 8081
  notification   → port 3005
  dashboard      → port 3100 (Next.js)
  postgres       → port 5432
  redis          → port 6379
  minio          → port 9000 (API), 9001 (Console)
  kafka          → port 9092
  zookeeper      → port 2181
  prometheus     → port 9090
  grafana        → port 3200
  jaeger         → port 16686
  loki           → port 3100 (internal)
  alertmanager   → port 9093

Volumes:
  postgres_data
  redis_data
  minio_data
  prometheus_data
  grafana_data
  loki_data
  edge_a_cache
  edge_b_cache
```

### Production (Kubernetes — Phase 5)

```
Namespace: edgesphere

Deployments (HPA enabled):
  api-gateway       min:2  max:10  targetCPU:70%
  auth-service      min:2  max:5
  storage-service   min:2  max:8
  analytics-service min:1  max:4
  edge-server       min:3  max:20 (DaemonSet on edge nodes)
  notification      min:1  max:3

StatefulSets:
  postgresql  (primary + read replica)
  redis       (sentinel mode: 1 primary, 2 replicas)
  kafka       (3 brokers)

Services:
  nginx-ingress (LoadBalancer)
  All others    (ClusterIP)

ConfigMaps / Secrets:
  app-config (env vars)
  db-credentials (sealed secrets)
  jwt-secrets (sealed secrets)
  minio-credentials (sealed secrets)
```

---

## 5. Security Architecture

```
Layer              Control
─────────────────────────────────────────────────────────
Network            TLS 1.3 everywhere; no plain HTTP
Authentication     JWT (RS256); API key HMAC-SHA256
Authorization      RBAC (admin/user/viewer)
Rate Limiting      Per-IP: 100req/min; Per-user: 1000req/min
Input Validation   Joi/Zod schemas on all endpoints
SQL Injection      Parameterized queries (TypeORM)
File Upload        MIME type check; file size limit 5GB
Secrets            Environment variables only; never in code
CORS               Allowlist-based; credentials mode
Headers            HSTS, CSP, X-Frame-Options, X-XSS-Protection
```

---

## 6. Technology Decisions & Trade-offs

| Decision | Chosen | Alternative | Reason |
|----------|--------|-------------|--------|
| API Framework | NestJS | Express, Fastify | Structured, DI, built-in pipes/guards |
| Edge Language | Go | Node.js, Rust | Performance, low memory, goroutines |
| Cache | Redis | Memcached | Pub/sub for invalidation; rich data types |
| Storage | MinIO | AWS S3 | Self-hostable, S3-compatible API |
| Messaging | Kafka | RabbitMQ | High-throughput, replay capability |
| Time-series | TimescaleDB | InfluxDB | SQL interface, built on PostgreSQL |
| Image Processing | libvips | ImageMagick | 4-8x faster, lower memory |
| Tracing | Jaeger | Zipkin | Better UI, native OpenTelemetry support |
| Log Aggregation | Loki | ELK Stack | Lighter weight, native Grafana integration |
| IaC | Terraform | Pulumi | More tooling, larger community |

---

## 7. Dashboard Real-Data Integration (Phase 6)

> Added after a full audit of the dashboard confirmed several pages were rendering mock/hardcoded
> data despite the backend already supporting them, plus a few real backend bugs that were silently
> breaking data end-to-end. All 11 dashboard pages are now wired to live backend data; the mock-data
> gaps and the bugs that were fixed are recorded here so they aren't rediscovered.

### 7.1 What changed

| Page | Before | Now |
|------|--------|-----|
| Overview | Hardcoded edge-server cards; summary stats read wrong field names (rendered `NaN%`) | Real edge stats (auto-discovered from traffic), correct field mapping |
| Storage | `MOCK_BUCKETS`/`MOCK_FILES` arrays, fake `setTimeout` actions | Full CRUD against `storage-service` (Postgres + MinIO) |
| CDN | Hardcoded stats, simulated purge | Real purge via `cache-service`, real Redis-backed stats |
| API Keys | Client-side fake key generation, no backend calls | Real `ApiKeyEntity` (new) in `auth-service`, persisted create/list/revoke |
| Edge Servers | Hardcoded 2-edge array | `GET /analytics/edges` — grouped by `edge_region` from `request_events` |
| Logs | `Math.random()`-generated rows on every render | `GET /analytics/events/search` — real filter/pagination |
| Settings | Static defaults, "Save" did nothing | Real profile `GET/PATCH /auth/me`; real, admin-gated Platform Configuration (see 7.2) |
| Monitoring | Hardcoded "online" badges | Real per-service health via gateway's `/health` aggregator |

### 7.2 Platform Configuration (new)

`GET/PATCH /config` on the gateway, backed by a single Redis hash (`edgesphere:platform_config`):

```
GET  /config   → any authenticated user (read-only)
PATCH /config  → admin role only (403 for non-admins) — first real consumer of the
                 @Roles()/RolesGuard scaffolding in auth-service, which existed but had
                 never been applied to a route before this
```

Three settings, all genuinely enforced (not just stored):
- `rateLimitPerIp` — read by `gateway`'s `AuthMiddleware` on every authenticated request (previously
  hardcoded to `100`).
- `cacheTtlSeconds` — read by `cdn-service`'s `CdnService` on every cache write (previously frozen at
  the value of `CACHE_TTL_SECONDS` read once at boot).
- `maxFileSizeMb` — checked by `storage-service`'s `FilesService.uploadFile()` before any MinIO call;
  previously there was **no file size limit enforced anywhere**.

Cross-service reads all resolve to the same physical Redis key despite each service's Redis client
using different prefix conventions — see `apps/gateway/src/config/platform-config.service.ts` for the
canonical key and the comment explaining each service's prefix handling.

### 7.3 Backend bugs found and fixed during this pass

These were not dashboard bugs — they were real backend defects the audit surfaced:

1. **`RequestEventEntity.userId`** (`apps/analytics-service/src/analytics/request-event.entity.ts`)
   had no `name: 'user_id'` column mapping, unlike every sibling column. Raw-SQL reads never hit this,
   but the moment an entity-metadata-driven insert was added, every Kafka-consumed request event
   failed to persist — `request_events` had been empty since the service was first stood up.
2. **`storage-service`** had `DB_USERNAME` instead of `DB_USER` in its TypeORM config — docker-compose
   never set that variable, so it silently used the wrong default credentials and crash-looped.
3. **`storage-service`** and **`gateway`** both `import` the `express` package directly in source but
   never declared it as a direct dependency (only pulled transitively via `@nestjs/platform-express`)
   — worked locally via pnpm hoisting, `MODULE_NOT_FOUND` inside Docker's strict linking.
4. **`storage-service`** had no `/health` endpoint at all (the only backend service missing one),
   which made the gateway's health aggregator — and the dashboard's Service Health panel — correctly
   but confusingly report it as "down" even while functioning normally.
5. **`websocket-gateway`**'s live metrics emitter (`kafka-consumer.service.ts`) emitted
   `Math.random()` for req/s, cache-hit-ratio, latency, and error-rate every 5 seconds — this fed the
   "Live" indicator shown in the dashboard topbar on every page. Replaced with a real rolling window
   computed from the `request.events` messages the same consumer already receives.
6. **`cache-service`**'s `getCacheStats()` hardcoded `hitRatio: 0.95`. The CDN dashboard page now
   sources cache hit ratio from `analytics-service`'s real `getCacheHitRatio()` instead.

---

*Architecture diagrams will be updated after each phase is completed.*

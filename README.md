# ⚡ EdgeSphere

> A self-hosted cloud platform combining Cloudflare + AWS S3 + API Gateway + CDN + Analytics into one system — built from scratch as a learning project.

[![CI](https://github.com/your-org/edgesphere/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/edgesphere/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20-green)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-blue)](https://docs.docker.com/compose/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-1.28-blue)](https://kubernetes.io/)

---

## 🎯 What Is EdgeSphere?

EdgeSphere is a **production-grade, self-hosted cloud platform** that implements the core infrastructure services used by Cloudflare, AWS S3, and API Gateway — all from scratch.

This is **not a CRUD app**. It's a distributed system demonstrating:

| Concept | Implementation |
|---------|---------------|
| **Distributed Caching** | 3-layer cache (Memory → Redis → Origin) |
| **Event-Driven Architecture** | Kafka for async communication between 10 services |
| **Microservices** | 9 NestJS services + 1 Next.js dashboard |
| **Real-time Systems** | Socket.io WebSocket gateway for live metrics |
| **CDN & Edge Computing** | Image optimization, geo routing, cache invalidation |
| **API Gateway Pattern** | Circuit breaker, rate limiting (Token Bucket + Sliding Window) |
| **Observability** | Prometheus + Grafana + Jaeger + Loki full stack |
| **OAuth2** | Google + GitHub SSO via Passport.js |
| **Cloud-Native** | Kubernetes manifests + HPA + Terraform for AWS EKS |
| **CI/CD** | GitHub Actions: lint → test → build → push → deploy |

---

## 🏗 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Internet / Users                                │
└──────────────────────────┬──────────────────────────────────────────────┘
                           │
           ┌───────────────▼───────────────┐
           │      Nginx Reverse Proxy       │
           │   (SSL, Gzip, Rate Limit)      │
           └───────┬───────────────┬────────┘
                   │               │
     ┌─────────────▼──┐   ┌───────▼──────────┐
     │   API Gateway  │   │   CDN Edge (×2)  │
     │   :3000        │   │   :8080 / :8081  │
     │ JWT + Rate Limit│   │ Redis L1 Cache   │
     │ Circuit Breaker│   │ Image Optimizer  │
     └──┬──┬──┬──┬───┘   └──────────┬───────┘
        │  │  │  │                   │
   ┌────┘  │  │  └────┐             │
   ▼       ▼  ▼       ▼             ▼
[Auth]  [Storage] [Analytics]  [MinIO S3]
:3001   :3002     :3003         Object Store
   │       │         │
   └───────┴────┬────┘
                │ Kafka (request.events, storage.events, alerts)
                ▼
    ┌───────────────────────┐
    │  Analytics Service     │  TimescaleDB queries
    │  Notification Service  │  Email + Webhook + Slack
    │  WebSocket Gateway     │  Real-time dashboard
    │  Cache Service         │  Distributed invalidation
    └───────────────────────┘
```

---

## 📦 Tech Stack

### Backend Services (Node.js/TypeScript)
| Service | Port | Tech | Description |
|---------|------|------|-------------|
| **API Gateway** | 3000 | NestJS | JWT auth, rate limiting, circuit breaker, proxy |
| **Auth Service** | 3001 | NestJS + Passport | JWT, OAuth2 (Google/GitHub), RBAC, multi-session |
| **Storage Service** | 3002 | NestJS + MinIO | S3-compatible, multipart upload, file versioning |
| **Analytics Service** | 3003 | NestJS + TimescaleDB | Kafka consumer, 11 SQL queries, time-series |
| **Cache Service** | 3004 | NestJS + Redis | Distributed cache purge, pub/sub invalidation |
| **Notification Service** | 3005 | NestJS + KafkaJS + NodeMailer | Alert rules, Mailtrap SMTP email/webhook/Slack delivery |
| **WebSocket Gateway** | 3006 | NestJS + Socket.io | Real-time metrics, live event streaming |
| **CDN Edge A** | 8087 | Node.js + Sharp | Redis cache, image optimization, geo routing |
| **CDN Edge B** | 8088 | Node.js + Sharp | Second edge (eu-west-1 simulation) |

### Frontend
| Service | Port | Tech | Description |
|---------|------|------|-------------|
| **Dashboard** | 3000 | Next.js 14 | Premium dark UI, 11 pages, SWR + WebSocket |

### Infrastructure
| Component | Tech | Role |
|-----------|------|------|
| Database | PostgreSQL 15 + TimescaleDB | Users, buckets, files, analytics hypertable |
| Cache | Redis 7 | L1 cache, sessions, rate limiting, pub/sub |
| Object Storage | MinIO | S3-compatible file storage |
| Message Queue | Apache Kafka | Event streaming between services |
| Email Delivery | Mailtrap | Transactional email delivery for automated alerts |
| Metrics | Prometheus | Scrapes `/metrics` from all services |
| Dashboards | Grafana | Visualizes all Prometheus metrics |
| Tracing | Jaeger | Distributed request tracing |
| Logs | Loki | Centralized log aggregation |

---

## 🚀 Quick Start

### Prerequisites
- Docker + Docker Compose
- Node.js 20+
- pnpm 9+

### 1. Clone & Install
```bash
git clone https://github.com/your-org/edgesphere.git
cd edgesphere
pnpm install
```

### 2. Start Infrastructure
```bash
bash scripts/start.sh --infra-only
```
This starts: PostgreSQL, Redis, MinIO, Kafka, Prometheus, Grafana, Jaeger

### 3. Start Services (Development)
```bash
# Each in a separate terminal:
cd apps/auth-service    && pnpm dev  # :3001
cd apps/gateway         && pnpm dev  # :3000
cd apps/storage-service && pnpm dev  # :3002
cd apps/analytics-service && pnpm dev # :3003
cd apps/cdn-service     && pnpm dev  # :8087
cd apps/dashboard       && pnpm dev  # :3000
```

### 4. Or Start Everything with Docker
```bash
bash scripts/start.sh
```

### 5. Access
| Service | URL |
|---------|-----|
| **Dashboard** | http://localhost:3000 |
| **API Gateway** | http://localhost:3000 (API endpoints) |
| **Grafana** | http://localhost:3200 (admin/admin) |
| **Prometheus** | http://localhost:9090 |
| **Jaeger** | http://localhost:16686 |
| **MinIO Console** | http://localhost:9001 |

---

## 📸 Key Features

### 🌐 CDN with Image Optimization
```bash
# Upload a file
curl -X POST http://localhost:3000/v1/storage/buckets/my-bucket/files \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@photo.jpg"

# Serve original
curl http://localhost:8087/cdn/my-bucket/photo.jpg

# Serve as WebP, 400px wide, 80% quality — transforming in real-time:
curl http://localhost:8087/cdn/my-bucket/photo.jpg?w=400&fmt=webp&q=80

# Cache headers returned:
# X-Cache: MISS (first request)
# X-Cache: HIT  (subsequent — served from Redis in ~2ms)
# Cache-Control: public, max-age=3600
```

### ⚡ Rate Limiting (Two Algorithms)
```bash
# Token Bucket (per API key — allows burst):
# 100 tokens, refill 10/second
# Headers: X-RateLimit-Limit, X-RateLimit-Remaining

# Sliding Window (per IP — strict):
# 100 requests per 60-second window
# Uses Redis ZSET for O(log n) operations

# 429 response:
# { "error": "Rate limit exceeded", "retryAfter": 23 }
# Retry-After: 23
```

### 🔌 WebSocket Real-time
```javascript
const socket = io('http://localhost:3006/realtime');
socket.emit('subscribe', ['metrics', 'events', 'alerts']);

socket.on('metrics_update', (m) => {
  console.log(`${m.requestsPerSec} req/s | ${m.cacheHitRatio}% cache | ${m.avgLatencyMs}ms avg`);
});

socket.on('request_event', (event) => {
  console.log(`[${event.method}] ${event.path} → ${event.status} (${event.latencyMs}ms)`);
});

socket.on('alert_triggered', (alert) => {
  console.log(`🚨 ${alert.ruleName}: ${alert.currentValue} > ${alert.threshold}`);
});
```

### 📤 Resumable Multipart Upload
```bash
# For files > 5MB, use multipart:
# 1. Initiate
curl -X POST http://localhost:3000/v1/storage/multipart/initiate \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"bucket":"my-bucket","key":"large-file.mp4","contentType":"video/mp4","totalSize":104857600}'
# Returns: { uploadId, partCount: 20, partSize: 5242880 }

# 2. Upload parts (can be done in parallel)
curl -X PUT http://localhost:3000/v1/storage/multipart/{uploadId}/parts/1 \
  -H "Content-Type: application/octet-stream" \
  --data-binary @chunk-001.bin

# 3. Complete
curl -X POST http://localhost:3000/v1/storage/multipart/{uploadId}/complete
```

---

## 📊 Performance Targets

| Metric | Target | Implementation |
|--------|--------|---------------|
| CDN Cached P95 | < 50ms | Redis L1 + memory L2 cache |
| API Gateway P95 | < 200ms | NestJS + circuit breaker |
| Cache Hit Ratio | > 80% | Smart cache-key + TTL management |
| Throughput | > 1000 req/sec | Horizontal scaling + CDN offloading |
| Availability | 99.9% | Circuit breaker + health probes + HPA |

---

## 🗺 Roadmap

- [x] Phase 1 — Foundation (Auth, Gateway, Storage, Dashboard)
- [x] Phase 2 — CDN & Edge (Image optimization, Cache layers)
- [x] Phase 3 — Analytics (Kafka, TimescaleDB, Notifications)
- [x] Phase 4 — Resilience (Circuit Breaker, OAuth2, WebSocket, Multipart)
- [x] Phase 5 — Production (Kubernetes, Terraform, CI/CD, Load Tests)
- [ ] Phase 6 — Video transcoding (FFmpeg + HLS streaming)
- [ ] Phase 7 — Multi-tenancy + billing

---

## 📚 Learning Guide

This project teaches:
1. **Distributed Caching** — Redis pub/sub, cache invalidation, cache key design
2. **Message Queues** — Kafka consumer groups, dead letter queues, exactly-once semantics
3. **Rate Limiting** — Token bucket vs sliding window, Redis-based implementation
4. **Circuit Breaker** — Opossum, OPEN/CLOSED/HALF-OPEN states, fallback strategies
5. **Time-Series DB** — TimescaleDB hypertables, `time_bucket()`, `percentile_cont()`
6. **OAuth2 Flow** — Authorization code flow, PKCE, token rotation
7. **WebSocket** — Socket.io rooms, Kafka → WebSocket bridge
8. **Kubernetes** — Deployments, HPA, Ingress, ConfigMaps, Secrets, PVCs
9. **Terraform** — VPC, EKS, RDS, ElastiCache modules, remote state
10. **Observability** — Prometheus + Grafana + Jaeger + Loki stack

---

## License
MIT © Yash Kumar Meena

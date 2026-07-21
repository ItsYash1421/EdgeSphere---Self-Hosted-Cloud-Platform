<div align="center">

# ⚡ EdgeSphere

### Self-hosted cloud infrastructure platform

[![CI](https://github.com/yourusername/EdgeSphere/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/EdgeSphere/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)
![Go](https://img.shields.io/badge/Go-1.22-00ADD8?logo=go)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)

> Build a cloud platform combining Cloudflare + AWS S3 + API Gateway + Analytics + CDN from scratch.  
> Not another CRUD app — a real distributed system.

</div>

---

## What is EdgeSphere?

EdgeSphere is a self-hosted cloud platform built as a learning project to deeply understand distributed systems, networking, and cloud infrastructure. It replicates the core capabilities of:

- **Cloudflare** → Edge servers, CDN, reverse proxy, DDoS protection
- **AWS S3** → Object storage with buckets, versioning, presigned URLs
- **AWS API Gateway** → JWT auth, rate limiting, routing, logging
- **Datadog/Grafana Cloud** → Metrics, logs, traces, dashboards

---

## Architecture

```
                          Internet
                              │
                    Nginx Reverse Proxy
                    (SSL, CORS, Gzip)
                              │
                 ┌────────────┴────────────┐
                 │                         │
          Edge Server A              Edge Server B
            (Go, 8080)                (Go, 8081)
          Redis + Disk Cache        Redis + Disk Cache
                 │                         │
                 └────────────┬────────────┘
                              │ Cache Miss
                         API Gateway
                        (NestJS, 3000)
                              │
         ┌────────┬───────────┼───────────┬────────────┐
         │        │           │           │            │
      Auth     Storage    Analytics    Cache     Notification
     (3001)   (3002)      (3003)      (3004)     (3005)
         │        │           │
    PostgreSQL  MinIO    TimescaleDB
      Redis              Kafka
```

---

## Services

| Service | Language | Port | Description |
|---------|----------|------|-------------|
| `api-gateway` | NestJS | 3000 | Routing, JWT, rate limiting, metrics |
| `auth-service` | NestJS | 3001 | JWT, OAuth, RBAC, API keys |
| `storage-service` | NestJS | 3002 | S3-compatible object storage |
| `analytics-service` | NestJS | 3003 | Request analytics, time-series |
| `edge-server` | **Go** | 8080/8081 | CDN edge with Redis+disk cache |
| `notification-service` | NestJS | 3005 | Email, webhook, Slack alerts |
| `dashboard` | Next.js | 3100 | Management UI |

---

## Tech Stack

```
Frontend:    Next.js · TypeScript · Tailwind CSS · Chart.js
Backend:     NestJS · TypeScript · Go
Database:    PostgreSQL (TimescaleDB) · Redis
Storage:     MinIO (S3-compatible)
Messaging:   Apache Kafka
Monitoring:  Prometheus · Grafana · Jaeger · Loki
Container:   Docker · Docker Compose
CI/CD:       GitHub Actions
Infra (P5):  Kubernetes · Terraform
```

---

## Quick Start

### Prerequisites

- Docker + Docker Compose
- Node.js 20+
- pnpm 9+
- Go 1.22+ (for edge server development)

### Run locally

```bash
# Clone
git clone https://github.com/yourusername/EdgeSphere.git
cd EdgeSphere

# Copy env files
cp apps/auth-service/.env.example apps/auth-service/.env
cp apps/storage-service/.env.example apps/storage-service/.env
# ... (repeat for each service)

# Start everything
docker compose -f infra/docker/docker-compose.dev.yml up --build

# Or for just infrastructure (DB, Redis, MinIO, Kafka)
docker compose -f infra/docker/docker-compose.dev.yml up postgres redis minio kafka
```

### Access points

| URL | Service |
|-----|---------|
| http://localhost:3100 | Dashboard |
| http://localhost:3000 | API Gateway |
| http://localhost:8080/cdn | Edge Server A |
| http://localhost:8081/cdn | Edge Server B |
| http://localhost:9001 | MinIO Console |
| http://localhost:3200 | Grafana |
| http://localhost:9090 | Prometheus |
| http://localhost:16686 | Jaeger UI |

---

## Development Roadmap

### ✅ Phase 1 — Foundation
- [x] Project scaffold (pnpm monorepo)
- [x] Auth service (JWT + RBAC)
- [x] Storage service (MinIO integration)
- [x] Docker Compose setup
- [ ] Dashboard basic UI

### 🔄 Phase 2 — CDN & Edge
- [x] Go edge server with Redis + disk cache
- [x] Cache hit/miss/invalidation
- [ ] Image optimization pipeline
- [ ] Geo-routing simulation

### ⏳ Phase 3 — Observability
- [x] Prometheus metrics on all services
- [x] Grafana dashboards
- [ ] Jaeger distributed tracing
- [ ] Analytics dashboard

### ⏳ Phase 4 — Event-Driven
- [ ] Kafka integration
- [ ] Notification service
- [ ] Event-driven cache invalidation

### ⏳ Phase 5 — Production
- [ ] Kubernetes manifests
- [ ] HPA configuration
- [ ] Terraform scripts
- [ ] Load testing (k6)

---

## API Documentation

When running locally, Swagger UI is available at:
- Auth Service: http://localhost:3001/docs
- Storage Service: http://localhost:3002/docs
- API Gateway: http://localhost:3000/docs

---

## System Design Decisions

### Why Go for Edge Servers?

Go's goroutine model and low memory footprint make it ideal for the edge server — each request is handled by a goroutine, and Redis connections are pooled. A Node.js alternative would use 5-10x more memory for the same concurrency.

### Why Redis pub/sub for Cache Invalidation?

When a file is updated/deleted, we need to purge it from ALL edge server caches simultaneously. Redis pub/sub broadcasts the invalidation message to all edge subscribers in ~1ms, regardless of how many edge instances are running.

### Why TimescaleDB over InfluxDB for Analytics?

TimescaleDB is PostgreSQL with time-series extensions — which means we get SQL, joins, and familiar tooling. InfluxDB has better raw performance but requires learning a new query language and can't join with relational data (like user tables).

### Why Kafka over RabbitMQ?

Kafka's log-based model allows consumers to **replay events** — critical for analytics (if the analytics service goes down, it can catch up from where it left off). RabbitMQ deletes messages after consumption, making replay impossible.

---

## Folder Structure

```
EdgeSphere/
├── apps/
│   ├── dashboard/          Next.js frontend
│   ├── gateway/            API Gateway (NestJS)
│   ├── auth-service/       Auth service (NestJS)
│   ├── storage-service/    Object storage (NestJS + MinIO)
│   ├── analytics-service/  Analytics (NestJS + TimescaleDB)
│   ├── edge-server/        CDN edge (Go)
│   └── notification-service/ (NestJS)
├── packages/
│   ├── shared/             Shared types & interfaces
│   ├── logger/             Structured logger (Pino)
│   ├── config/             Config helpers
│   └── sdk/                Client SDK
├── infra/
│   ├── docker/             Docker Compose configs
│   ├── k8s/                Kubernetes manifests (Phase 5)
│   ├── nginx/              Nginx configuration
│   ├── prometheus/         Prometheus config
│   ├── grafana/            Grafana dashboards
│   └── terraform/          IaC scripts (Phase 5)
└── docs/
    ├── PRD.md              Product Requirements
    ├── ARCHITECTURE.md     System design document
    └── LEARNING_GUIDE.md   Concepts and resources
```

---

## What You'll Learn Building This

- Distributed caching (Redis, cache invalidation strategies)
- CDN architecture (edge servers, cache hierarchies, TTL)
- API Gateway pattern (routing, rate limiting, JWT verification)
- Object storage internals (presigned URLs, multipart upload)
- Event-driven architecture (Kafka topics, consumers, DLQ)
- Observability (Prometheus, Grafana, distributed tracing)
- Kubernetes deployment (Pods, Services, HPA, Ingress)
- Go for high-performance proxy servers
- Microservices patterns (circuit breaking, service discovery)

---

## License

MIT — built for learning, feel free to fork and build on it.

---

<div align="center">
Built with ❤️ by Yash Kumar Meena
</div>

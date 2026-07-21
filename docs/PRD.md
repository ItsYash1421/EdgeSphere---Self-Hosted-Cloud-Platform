# EdgeSphere — Product Requirements Document (PRD)

> Version: 1.0.0  
> Author: Yash Kumar Meena  
> Date: July 2026  
> Status: Active Development

---

## 1. Executive Summary

**EdgeSphere** is a self-hosted, open-source cloud platform that combines the capabilities of Cloudflare, AWS S3, API Gateway, CDN, and Analytics into a single unified system. Built as a learning-focused engineering project, EdgeSphere is designed to demonstrate mastery of distributed systems, networking, cloud architecture, observability, and DevOps practices at a senior engineering level.

This is not a CRUD app. This is a platform.

---

## 2. Problem Statement

Modern cloud infrastructure (Cloudflare, AWS, GCP) is powerful but opaque — developers use these services without understanding the internals: how CDNs cache, how edge servers route, how API gateways rate-limit, or how distributed storage works. 

**EdgeSphere exists to demystify cloud infrastructure by building it from scratch.**

---

## 3. Goals

### Primary Goals
- Build a production-grade cloud platform with real edge caching, object storage, API gateway, and analytics.
- Gain deep, hands-on understanding of distributed systems concepts.
- Create a portfolio project that demonstrates senior-level engineering judgment and system design knowledge.

### Secondary Goals
- Generate architectural documentation, diagrams, and design decisions that can be discussed in SDE interviews.
- Build a scalable foundation that can be deployed locally (Docker Compose) and to cloud (Kubernetes/Terraform).
- Create a compelling GitHub repository with professional-grade README, CI/CD, and observability stack.

---

## 4. Target Users (for the platform itself)

| User Type | Description |
|-----------|-------------|
| **Developers** | Upload files, create buckets, use presigned URLs, manage API keys |
| **Platform Admins** | Monitor traffic, view analytics, manage edge servers, configure routing |
| **API Consumers** | Access resources through API Gateway with rate limiting and versioning |

---

## 5. Core Features & Requirements

### 5.1 Authentication & Authorization Service

| Feature | Priority | Description |
|---------|----------|-------------|
| JWT Authentication | P0 | Access/Refresh token pair |
| OAuth 2.0 | P1 | Google, GitHub login |
| RBAC | P0 | Role-Based Access Control (admin, user, viewer) |
| API Keys | P0 | Per-user API key generation and management |
| Token Refresh | P0 | Silent refresh, token rotation |
| MFA | P2 | TOTP-based multi-factor authentication |

**Acceptance Criteria:**
- Users can register, login, and receive JWT access + refresh tokens
- RBAC gates all API endpoints appropriately
- API keys can be created, rotated, and revoked
- Refresh tokens are rotated on use (one-time use)

---

### 5.2 API Gateway

| Feature | Priority | Description |
|---------|----------|-------------|
| Request Routing | P0 | Route to appropriate microservice |
| JWT Verification | P0 | Validate token on every request |
| Rate Limiting | P0 | Token Bucket & Sliding Window algorithms |
| Request Logging | P0 | Log all requests with metadata |
| Metrics Collection | P0 | Export metrics to Prometheus |
| Response Caching | P1 | Cache GET responses with TTL |
| API Versioning | P1 | `/v1/`, `/v2/` routing |
| Circuit Breaker | P2 | Prevent cascade failures |

**Acceptance Criteria:**
- Gateway correctly routes all service traffic
- Rate limits are enforced per API key and per IP
- All requests are logged with: timestamp, user, IP, latency, status, cache hit/miss

---

### 5.3 Object Storage Service (S3-compatible)

| Feature | Priority | Description |
|---------|----------|-------------|
| Bucket CRUD | P0 | Create, list, delete buckets |
| File Upload | P0 | Single file upload |
| File Download | P0 | Stream file from storage |
| File Delete | P0 | Delete file from bucket |
| Multipart Upload | P1 | Large file chunked upload |
| Presigned URLs | P1 | Time-limited URL for file access |
| File Versioning | P1 | Keep multiple versions of a file |
| Access Policies | P2 | Public/Private/Restricted bucket policies |
| Storage Backend | P0 | MinIO (S3-compatible) as storage layer |

**Acceptance Criteria:**
- Files can be uploaded and downloaded reliably
- Presigned URLs expire correctly and cannot be reused after expiry
- Multipart upload handles files >100MB efficiently

---

### 5.4 CDN (Content Delivery Network)

| Feature | Priority | Description |
|---------|----------|-------------|
| Edge Caching | P0 | Cache files at edge servers |
| Cache Hit/Miss | P0 | Serve from cache or fetch from origin |
| Cache Invalidation | P0 | Purge cache across all edges |
| TTL Management | P0 | Per-file cache TTL configuration |
| Image Optimization | P1 | Resize/compress/WebP conversion on the fly |
| Video Processing | P2 | FFmpeg-based HLS transcoding pipeline |
| Geo Routing | P1 | Route user to nearest edge server |
| Cache Headers | P0 | `Cache-Control`, `ETag`, `Last-Modified` |

**Acceptance Criteria:**
- Cache hit ratio > 80% for repeated requests
- Cache purge propagates to all edges within 1 second
- Images are transformed in real-time based on query parameters (`?w=400&h=300&fmt=webp`)

---

### 5.5 Reverse Proxy

| Feature | Priority | Description |
|---------|----------|-------------|
| SSL Termination | P0 | HTTPS termination at proxy layer |
| Gzip Compression | P0 | Compress responses |
| Brotli Compression | P1 | Better compression for modern browsers |
| Header Rewriting | P1 | Add/remove request/response headers |
| CORS Management | P0 | Configurable CORS policies |
| Health Checks | P0 | Upstream health monitoring |
| Load Balancing | P0 | Round Robin, Least Connections |

---

### 5.6 Analytics Service

| Metric | Priority | Description |
|--------|----------|-------------|
| Requests/sec | P0 | Real-time request rate |
| Cache Hit Ratio | P0 | Percentage of cache hits |
| Active Users | P0 | Current active sessions |
| Geographic Distribution | P1 | Requests by country/region |
| Response Time (P50/P95/P99) | P0 | Latency percentiles |
| Bandwidth Usage | P0 | Egress/ingress in bytes |
| Storage Usage | P0 | Per-bucket storage metrics |
| Error Rate | P0 | 4xx/5xx rate over time |
| Top Files | P1 | Most accessed files |
| Top IPs | P1 | Highest traffic sources |

---

### 5.7 Monitoring Stack

| Tool | Role |
|------|------|
| **Prometheus** | Metrics scraping and storage |
| **Grafana** | Dashboard visualization |
| **Jaeger** | Distributed tracing |
| **Loki** | Log aggregation |
| **Alertmanager** | Alerting on thresholds |

---

### 5.8 Notification Service

| Channel | Priority |
|---------|----------|
| Email (SMTP/SendGrid) | P1 |
| Webhooks | P1 |
| Slack | P2 |
| Discord | P2 |

**Triggers:** Storage quota exceeded, unusual traffic spike, edge server down, cache purge completed

---

### 5.9 Dashboard (Frontend)

| Page | Priority | Description |
|------|----------|-------------|
| Overview | P0 | Key metrics summary, system health |
| Storage | P0 | Bucket management, file browser |
| Analytics | P0 | Charts, graphs, realtime metrics |
| Edge Servers | P1 | Edge server status, cache stats |
| API Keys | P0 | Create/revoke API keys |
| Settings | P0 | Account, billing, notification config |
| Logs | P1 | Searchable request logs |
| Monitoring | P2 | Embedded Grafana dashboards |

---

## 6. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Performance** | P95 API response < 200ms; P95 cached edge response < 50ms |
| **Scalability** | Horizontal scaling for all services; stateless services |
| **Reliability** | 99.9% uptime target; graceful degradation on edge failure |
| **Security** | HTTPS everywhere; secrets in env vars; input validation; SQL injection prevention |
| **Observability** | Full distributed traces; structured JSON logs; Prometheus metrics on every service |
| **Portability** | Local dev with Docker Compose; production on Kubernetes |
| **Documentation** | Architecture diagrams (C4 model); API docs (OpenAPI/Swagger); README |

---

## 7. Architecture Constraints & Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Primary Language** | TypeScript (NestJS) | Type safety, strong ecosystem, good for learning microservices |
| **Edge Servers** | Go | High performance, low memory, ideal for proxy/cache layer |
| **Database** | PostgreSQL | Relational, ACID compliant, battle-tested |
| **Cache** | Redis | Industry standard, supports pub/sub for cache invalidation |
| **Storage** | MinIO | S3-compatible API, self-hostable, production-grade |
| **Messaging** | Kafka | High-throughput event streaming for analytics/notifications |
| **Container** | Docker + Docker Compose | Local dev consistency |
| **Orchestration** | Kubernetes (Phase 5) | Production-grade scaling |
| **IaC** | Terraform | Reproducible infrastructure |
| **CI/CD** | GitHub Actions | Free for open source, integrates with GitHub |

---

## 8. Development Roadmap

### Phase 1 — Foundation (Weeks 1-3)
> Core services up and running locally

- [ ] Project scaffold (monorepo with pnpm workspaces)
- [ ] Auth service (JWT + RBAC + API keys)
- [ ] API Gateway (routing + JWT verification + rate limiting)
- [ ] Storage service (bucket CRUD + file upload/download)
- [ ] MinIO integration
- [ ] PostgreSQL + Redis setup
- [ ] Docker Compose for all services
- [ ] Basic dashboard (login, bucket management, file browser)

**Milestone Outcome:** Users can sign up, create buckets, upload files, and download them via API.

---

### Phase 2 — CDN & Edge (Weeks 4-6)
> The heart of the project

- [ ] Edge server in Go with Redis cache
- [ ] Cache hit/miss logic
- [ ] Cache invalidation (Redis pub/sub)
- [ ] Reverse proxy (SSL termination, Gzip, CORS)
- [ ] Geo routing simulation (multiple edge servers locally)
- [ ] Image optimization pipeline (Sharp/libvips)
- [ ] Cache headers (ETag, Cache-Control, Last-Modified)

**Milestone Outcome:** Files served through edge servers with caching. Cache purge works across edges.

---

### Phase 3 — Observability & Analytics (Weeks 7-9)
> Know what's happening inside

- [ ] Analytics service (request metrics aggregation)
- [ ] Prometheus metrics on all services
- [ ] Grafana dashboards (requests, latency, cache hit ratio, bandwidth)
- [ ] Distributed tracing with Jaeger
- [ ] Log aggregation with Loki
- [ ] Alertmanager rules
- [ ] Dashboard analytics page (Chart.js graphs)
- [ ] Rate limiter service (Token Bucket + Sliding Window)

**Milestone Outcome:** Full observability stack operational. All metrics visible in Grafana.

---

### Phase 4 — Event-Driven Architecture (Weeks 10-12)
> Make it reactive

- [ ] Kafka setup
- [ ] Event producers (auth events, storage events, gateway events)
- [ ] Event consumers (analytics ingestion, notification triggers)
- [ ] Notification service (email + webhooks)
- [ ] Cache invalidation events over Kafka
- [ ] Dead letter queues and retry logic
- [ ] Event schema registry

**Milestone Outcome:** Services communicate via events. Notifications working for key triggers.

---

### Phase 5 — Production-Grade (Weeks 13+)
> Ship it

- [ ] Kubernetes manifests for all services
- [ ] Horizontal Pod Autoscaling
- [ ] Multi-region simulation in k8s
- [ ] Terraform scripts for cloud deploy (optional)
- [ ] GitHub Actions CI/CD pipeline (lint → test → build → deploy)
- [ ] k6 load testing scripts
- [ ] Production README with architecture diagrams
- [ ] Video transcoding pipeline (FFmpeg + HLS)

**Milestone Outcome:** Deployable to any cloud. CI/CD running. Load tests passing.

---

## 9. Success Metrics

| Metric | Target |
|--------|--------|
| Services implemented | 8+ microservices |
| Test coverage | >70% on core services |
| Cache hit ratio (demo) | >80% |
| P95 latency (cached) | <50ms |
| GitHub stars goal | — |
| Architecture docs | C4 model diagrams |
| Load test throughput | >1000 req/sec sustained |

---

## 10. Out of Scope (v1)

- Billing and payment integration
- Multi-tenancy at database level (shared DB with tenant isolation via RBAC)
- Custom domain mapping for end users
- WebSocket support at Gateway layer
- Global anycast IP routing (requires real BGP infrastructure)

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Scope creep (too many features) | Strictly follow phase roadmap; park features in backlog |
| Performance issues with Go edge server | Profile early; use `pprof`; Redis for hot paths |
| Kafka complexity overhead | Start with RabbitMQ if Kafka proves difficult; migrate later |
| K8s complexity in Phase 5 | Use `kind` or `minikube` locally; document every step |
| MinIO data loss in dev | Mount Docker volumes; add backup scripts |

---

## 12. Definition of Done

A phase is complete when:
- [ ] All features from phase checklist are implemented
- [ ] All services have unit + integration tests
- [ ] Docker Compose starts all services cleanly with `docker compose up`
- [ ] README updated with new capabilities
- [ ] Architecture diagram updated
- [ ] At least one Grafana dashboard showing phase metrics

---

*This PRD is a living document and will be updated as the project evolves.*

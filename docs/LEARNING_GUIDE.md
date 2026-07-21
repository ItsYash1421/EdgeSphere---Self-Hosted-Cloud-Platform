# EdgeSphere — Learning Guide

> Your personal roadmap to mastering distributed systems, networking, and cloud infrastructure by building EdgeSphere.  
> Built for: Yash Kumar Meena | Updated: July 2026

---

## How to Use This Guide

This guide maps every concept you'll learn in EdgeSphere to:
1. **Why it matters** (interview + real-world context)
2. **What you'll build** (concrete implementation)
3. **Resources** (best articles, videos, books)
4. **Interview questions** (what you'll be able to answer)

Work through this phase by phase. After each phase, you should be able to **teach** the concepts to someone else.

---

## Phase 1 — Foundation

### 🔐 Concept 1: JWT & Authentication

**Why it matters:**  
Every real-world system needs auth. JWT is the industry standard for stateless auth in microservices. Understanding the difference between access tokens and refresh tokens, and how to implement rotation, is a key senior-engineer skill.

**What you'll build:**  
- JWT generation with RS256 (asymmetric — learn why RS256 > HS256)
- Refresh token rotation (one-time use)
- Token blacklisting with Redis
- RBAC middleware

**Deep Dive Topics:**
- What is a JWT? Structure: header.payload.signature
- HS256 vs RS256 — symmetric vs asymmetric signing
- Why short-lived access tokens (15 min)?
- Why refresh tokens need rotation (prevent replay attacks)
- What is RBAC vs ABAC vs PBAC?

**Resources:**
- 📄 [JWT.io Introduction](https://jwt.io/introduction)
- 📄 [Auth0: Refresh Token Rotation](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation)
- 📺 [Web Dev Simplified: JWT Auth Tutorial](https://www.youtube.com/watch?v=7Q17ubqLfaM)
- 📚 Book: "Designing Data-Intensive Applications" — Chapter on security

**Interview Questions:**
- What is the difference between authentication and authorization?
- Why are JWTs stateless? What's the trade-off?
- How do you invalidate a JWT before it expires?
- What is RBAC? How would you implement it at scale?
- How does OAuth 2.0 work? What is PKCE?
- What is the purpose of a refresh token?
- Why is RS256 preferred over HS256 in distributed systems?

---

### 🚦 Concept 2: API Gateway Pattern

**Why it matters:**  
The API Gateway is the #1 pattern in microservices. Almost every real-world system (Netflix, Uber, Amazon) has one. Understanding how to build one teaches you: routing, middleware chains, rate limiting, and observability.

**What you'll build:**  
- Request routing to microservices
- JWT verification middleware
- Rate limiter (Token Bucket + Sliding Window)
- Request/response logging
- Prometheus metrics endpoint

**Deep Dive Topics:**
- What problem does an API Gateway solve?
- Difference between API Gateway and Reverse Proxy
- How does middleware chaining work (request pipeline)?
- Token Bucket algorithm explained (math + code)
- Sliding Window algorithm explained
- What is circuit breaking? How does it prevent cascade failures?

**Resources:**
- 📄 [ByteByteGo: API Gateway](https://blog.bytebytego.com/p/api-gateway)
- 📺 [System Design: API Gateway](https://www.youtube.com/watch?v=vBc-6LScMYI)
- 📄 [Stripe Engineering: Rate Limiting](https://stripe.com/blog/rate-limiters)
- 📚 "Microservices Patterns" by Chris Richardson — Chapter 8 (API Gateway)

**Rate Limit Algorithms Explained:**

```
Token Bucket:
  - Bucket has capacity N tokens
  - Tokens refill at rate R per second
  - Each request consumes 1 token
  - If bucket empty → 429 Too Many Requests
  - Allows bursting up to N requests

Sliding Window:
  - Track request timestamps in a rolling window
  - Count requests in last T seconds
  - If count > limit → 429
  - More accurate, no burst allowed

Fixed Window:
  - Divide time into fixed buckets (e.g., 1 minute)
  - Count requests per bucket
  - Edge case: 2x burst possible at window boundary

Leaky Bucket:
  - Queue incoming requests
  - Process at fixed rate
  - Overflow = reject
  - Smooths out burst traffic
```

**Interview Questions:**
- What is the difference between API Gateway and Load Balancer?
- How does Token Bucket rate limiting work? Implement it.
- What is the "thundering herd" problem?
- How do you implement circuit breaking?
- What is the difference between synchronous and asynchronous APIs?
- How would you handle API versioning at scale?

---

### 💾 Concept 3: Object Storage (S3 Architecture)

**Why it matters:**  
Object storage is how every major company stores files — photos, videos, backups. Understanding how S3 works internally (how it shards, replicates, generates presigned URLs) is crucial for storage-related system design questions.

**What you'll build:**  
- Bucket management CRUD
- File upload/download via MinIO
- Presigned URL generation (time-limited, signed with HMAC)
- Multipart upload (for large files)
- File versioning

**Deep Dive Topics:**
- Difference between file storage, block storage, and object storage
- How Amazon S3 achieves 11-nines durability
- What is eventual consistency? (S3 pre-2020 was eventually consistent)
- How presigned URLs work (HMAC signing + expiry)
- How multipart upload works (parts → complete → single object)
- What is data sharding in distributed storage?

**Resources:**
- 📄 [AWS S3 How it Works](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html)
- 📺 [ByteByteGo: Amazon S3 Architecture](https://www.youtube.com/watch?v=UmWtcgC96X8)
- 📄 [MinIO Architecture](https://min.io/product/minio-architecture)
- 📚 "Designing Data-Intensive Applications" — Chapter 3 (Storage Engines)

**Interview Questions:**
- What is the difference between object storage and a file system?
- How does Amazon S3 achieve high durability (11 9s)?
- What is eventual consistency? How does S3 handle it?
- How do presigned URLs work? What prevents tampering?
- How would you design a distributed file storage system?
- What is erasure coding? How does it compare to replication?

---

## Phase 2 — CDN & Edge

### ⚡ Concept 4: Content Delivery Network (CDN)

**Why it matters:**  
CDN is literally how the internet is fast. Understanding CDN architecture — edge servers, cache hierarchy, cache invalidation — is one of the most commonly asked system design topics.

**What you'll build:**  
- Go-based edge server with two-level cache (Redis + disk)
- Cache hit/miss logic with proper headers (ETag, Cache-Control)
- Cache invalidation via Redis pub/sub
- Geo-routing simulation

**Deep Dive Topics:**
- What is a CDN? Why does it reduce latency?
- Edge server vs Origin server
- Cache hierarchy: L1 (Redis) → L2 (disk) → L3 (origin)
- HTTP cache headers: `Cache-Control`, `ETag`, `Last-Modified`, `Vary`
- Cache invalidation — why is it "one of the hardest problems in CS"?
- The CAP theorem applied to distributed caches
- Push CDN vs Pull CDN

**Cache Headers Reference:**
```http
Cache-Control: public, max-age=3600, s-maxage=86400
ETag: "abc123def456"
Last-Modified: Tue, 22 Jul 2026 00:00:00 GMT
Vary: Accept-Encoding, Accept
X-Cache: HIT
X-Cache-TTL: 3542
X-Edge-Region: us-east-1
```

**Resources:**
- 📄 [Cloudflare: How CDNs Work](https://www.cloudflare.com/learning/cdn/what-is-a-cdn/)
- 📺 [System Design: Design a CDN](https://www.youtube.com/watch?v=p2o1S3dTHo4)
- 📄 [MDN: HTTP Caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- 📄 [Facebook Engineering: TAO (Distributed Cache)](https://engineering.fb.com/2013/06/25/core-infra/tao-the-power-of-the-graph/)

**Interview Questions:**
- How does a CDN reduce latency?
- What is the difference between a CDN and a reverse proxy?
- How do you decide what to cache at the edge?
- What is cache invalidation? How do you purge cache across multiple edges?
- What are ETag and Cache-Control headers for?
- How would you design a CDN from scratch?
- What is the difference between push and pull CDN?

---

### 🖼️ Concept 5: Image Optimization

**Why it matters:**  
Image optimization is a massive real-world problem. Companies like Instagram, Pinterest, and Cloudflare built entire image processing pipelines. Understanding this teaches you about streams, image formats, and performance optimization.

**What you'll build:**  
- On-the-fly image resize (`?w=400&h=300`)
- Format conversion (JPEG → WebP → AVIF)
- Quality control (`?q=80`)
- Cache transformed variants separately

**Deep Dive Topics:**
- Why WebP is ~25-35% smaller than JPEG at same quality
- AVIF vs WebP vs JPEG vs PNG — when to use which
- How libvips achieves high performance (streaming pipeline)
- Perceptual hashing for deduplication

**Resources:**
- 📄 [Google: Image Optimization Fundamentals](https://web.dev/fast/#optimize-your-images)
- 📄 [libvips architecture](https://libvips.github.io/libvips/API/current/How-it-works.md.html)
- 📺 [ByteByteGo: How Cloudflare Images Work](https://blog.cloudflare.com/images-0-for-free-of-them/)

---

### 🔄 Concept 6: Reverse Proxy

**Why it matters:**  
Nginx, HAProxy, Envoy — every serious production system uses a reverse proxy. Understanding how they work teaches you: TCP/HTTP internals, TLS, compression, connection pooling.

**What you'll build:**  
- Nginx configuration (SSL, Gzip, headers)
- Understanding of how SSL termination works
- CORS handling at proxy layer

**Deep Dive Topics:**
- What is the difference between a forward proxy and reverse proxy?
- How does SSL/TLS termination work?
- What is SNI (Server Name Indication)?
- How does Gzip work? What is the compression ratio?
- What is HTTP/2 multiplexing?

**Resources:**
- 📄 [Nginx Documentation](https://nginx.org/en/docs/)
- 📺 [Hussein Nasser: Nginx as Reverse Proxy](https://www.youtube.com/watch?v=7VAI73roXaY)
- 📄 [Cloudflare: How TLS Works](https://www.cloudflare.com/learning/ssl/what-happens-in-a-tls-handshake/)

**Interview Questions:**
- What is the difference between a load balancer and a reverse proxy?
- How does TLS termination work?
- What is HTTP/2? How is it different from HTTP/1.1?
- How does Gzip/Brotli compression work?

---

## Phase 3 — Observability & Analytics

### 📊 Concept 7: Distributed Tracing

**Why it matters:**  
In microservices, when a request fails, how do you know which service caused it? Distributed tracing answers this by tracking a request across every service it touches.

**What you'll build:**  
- OpenTelemetry instrumentation on all NestJS services
- Trace context propagation (W3C TraceContext headers)
- Jaeger UI for viewing traces

**Deep Dive Topics:**
- What is a trace? A span? A trace context?
- W3C TraceContext: `traceparent` and `tracestate` headers
- Sampling strategies: head-based vs tail-based
- How Jaeger stores and indexes traces

**Resources:**
- 📄 [OpenTelemetry Docs](https://opentelemetry.io/docs/)
- 📄 [Jaeger Getting Started](https://www.jaegertracing.io/docs/getting-started/)
- 📺 [ByteByteGo: Distributed Tracing Explained](https://www.youtube.com/watch?v=EW67_XfObF4)

**Interview Questions:**
- What is distributed tracing? How is it different from logging?
- What is a trace ID? How does it propagate across services?
- What is the difference between metrics, logs, and traces?
- What is the "three pillars of observability"?

---

### 📈 Concept 8: Metrics & Prometheus

**Why it matters:**  
Prometheus is the industry standard for metrics. Understanding how to instrument code, write PromQL queries, and design dashboards is a key SRE/DevOps skill.

**What you'll build:**  
- Prometheus metrics on every service
- Grafana dashboards with PromQL queries
- Alertmanager rules (latency > 500ms, error rate > 1%)

**Deep Dive Topics:**
- Four types of Prometheus metrics: Counter, Gauge, Histogram, Summary
- How Prometheus scrapes metrics (pull model)
- PromQL basics: rate(), increase(), histogram_quantile()
- Push vs Pull model for metrics (Prometheus vs StatsD)

**PromQL Cheatsheet:**
```promql
# Requests per second (last 5 minutes)
rate(http_requests_total[5m])

# 95th percentile latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Error rate percentage
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) * 100

# Cache hit ratio
rate(edge_cache_hits_total[5m]) / (rate(edge_cache_hits_total[5m]) + rate(edge_cache_misses_total[5m]))
```

**Resources:**
- 📄 [Prometheus Getting Started](https://prometheus.io/docs/prometheus/latest/getting_started/)
- 📺 [TechWorld with Nana: Prometheus Tutorial](https://www.youtube.com/watch?v=h4Sl21AKiDg)
- 📄 [Grafana Dashboard Best Practices](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices/)

---

## Phase 4 — Event-Driven Architecture

### 📨 Concept 9: Message Queues & Kafka

**Why it matters:**  
Kafka powers the data pipelines of LinkedIn, Uber, Airbnb, Netflix. Understanding event-driven architecture (producers, consumers, topics, partitions) is essential for building scalable, decoupled systems.

**What you'll build:**  
- Kafka setup with 3 topics (auth-events, storage-events, request-events)
- Producers in each service
- Analytics consumer that ingests events
- Notification consumer for trigger-based alerts
- Dead letter queue for failed events

**Deep Dive Topics:**
- Kafka vs RabbitMQ vs SQS — when to use which
- Kafka concepts: Topics, Partitions, Consumer Groups, Offsets
- Exactly-once semantics vs at-least-once vs at-most-once
- How Kafka achieves high throughput (sequential disk writes)
- What is a dead letter queue (DLQ)?
- Event sourcing pattern

**Kafka Mental Model:**
```
Producer → Topic (N Partitions) → Consumer Group
                │
                └── Partition 0 → Consumer A
                └── Partition 1 → Consumer B
                └── Partition 2 → Consumer C

Each partition: ordered, append-only log
Each message: has an offset (like array index)
Consumer tracks its own offset (can replay from any point)
```

**Resources:**
- 📄 [Kafka Documentation](https://kafka.apache.org/documentation/)
- 📺 [TechWorld with Nana: Kafka Tutorial](https://www.youtube.com/watch?v=ut5kp56wW_4)
- 📄 [Confluent: Kafka vs RabbitMQ](https://www.confluent.io/blog/kafka-vs-rabbitmq-choosing-the-right-messaging-system/)
- 📚 "Designing Data-Intensive Applications" — Chapter 11 (Stream Processing)

**Interview Questions:**
- What is the difference between a message queue and an event streaming platform?
- How does Kafka achieve high throughput?
- What is a consumer group? Why is it useful?
- What is exactly-once delivery? How does Kafka achieve it?
- When would you choose Kafka over RabbitMQ?
- What is event sourcing? How is it different from traditional CRUD?
- What is a dead letter queue?

---

## Phase 5 — Kubernetes & Production

### ☸️ Concept 10: Kubernetes

**Why it matters:**  
K8s is the de facto standard for container orchestration. Every major tech company runs on Kubernetes (or a managed variant). Understanding Pods, Deployments, Services, HPA is fundamental to modern backend engineering.

**What you'll build:**  
- K8s manifests for all EdgeSphere services
- Horizontal Pod Autoscaling (HPA) based on CPU/RPS
- ConfigMaps and Secrets
- Ingress with Nginx

**Deep Dive Topics:**
- Kubernetes architecture: Control plane (API Server, etcd, Scheduler, Controller Manager) + Node (kubelet, kube-proxy)
- Pod lifecycle: Pending → Running → Succeeded/Failed
- Deployments vs StatefulSets vs DaemonSets
- Service types: ClusterIP, NodePort, LoadBalancer
- How HPA works (metrics-server → HPA controller → scale)
- Resource requests vs limits

**Kubernetes Objects Reference:**
```yaml
# Deployment
kind: Deployment
spec:
  replicas: 3
  strategy: RollingUpdate   # zero-downtime deploy
  template: ...

# HPA
kind: HorizontalPodAutoscaler
spec:
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

# Service
kind: Service
spec:
  type: ClusterIP           # internal
  type: LoadBalancer        # external (cloud LB)
  type: NodePort            # debug only
```

**Resources:**
- 📄 [Kubernetes Official Docs](https://kubernetes.io/docs/)
- 📺 [TechWorld with Nana: Complete Kubernetes Course](https://www.youtube.com/watch?v=X48VuDVv0do)
- 📄 [Learnk8s: Production Best Practices](https://learnk8s.io/production-best-practices)

**Interview Questions:**
- What is the difference between a Pod and a Deployment?
- How does Kubernetes handle rolling updates?
- What is the difference between a StatefulSet and a Deployment?
- How does HPA work? What metrics does it use?
- What is a Kubernetes Ingress? How is it different from a Service?
- What happens when a Pod crashes? How does K8s recover it?
- What is the difference between resource requests and limits?

---

## 🎯 System Design Interview Prep

After building EdgeSphere, you'll be able to confidently answer these system design questions:

### Questions You Can Now Answer

| Question | EdgeSphere Component |
|----------|---------------------|
| Design a CDN | Edge Server + Cache + Geo Routing |
| Design Amazon S3 | Storage Service + MinIO |
| Design an API Gateway | API Gateway service |
| Design a Rate Limiter | Rate limiter in Gateway |
| Design a URL Shortener | Auth + Storage + Analytics |
| Design Netflix/YouTube | CDN + Video processing pipeline |
| Design a notification system | Kafka + Notification service |
| Design a monitoring system | Prometheus + Grafana + Jaeger |
| Design a distributed cache | Redis cluster + cache invalidation |
| Design a load balancer | Nginx + Go edge routing |

---

### The Trade-offs You Can Discuss

These are the **key talking points** for senior SDE interviews:

1. **Redis vs Local Disk Cache at Edge**  
   Redis: shared across threads, fast, limited by RAM  
   Disk: persists across restarts, larger capacity, slower

2. **Kafka vs RabbitMQ**  
   Kafka: high throughput, replayable, log-based  
   RabbitMQ: lower latency, better for task queues, rich routing

3. **Cache Invalidation Strategies**  
   TTL-based (simple, stale data possible)  
   Event-based purge (complex, always fresh)  
   Cache-aside vs Write-through vs Write-behind

4. **Horizontal vs Vertical Scaling**  
   Horizontal: add more nodes, stateless services only  
   Vertical: bigger machine, limited by hardware ceiling

5. **TimescaleDB vs InfluxDB for Analytics**  
   TimescaleDB: SQL interface, easier migration, PostgreSQL ecosystem  
   InfluxDB: purpose-built, better compression, proprietary query language

6. **Consistency vs Availability (CAP Theorem)**  
   During network partition: choose one  
   Cassandra/DynamoDB: AP (eventually consistent)  
   PostgreSQL: CP (strongly consistent)

---

## 📚 Recommended Reading Order

### Books
1. **"Designing Data-Intensive Applications"** — Martin Kleppmann (THE bible for distributed systems)
2. **"System Design Interview"** — Alex Xu (practical interview prep)
3. **"Microservices Patterns"** — Chris Richardson (patterns for building microservices)
4. **"The Go Programming Language"** — Donovan & Kernighan (for edge server Go code)
5. **"Site Reliability Engineering"** — Google (SRE practices for production)

### Blogs to Follow
- ByteByteGo (system design deep dives)
- Engineering at Meta/Netflix/Cloudflare/Discord (real-world case studies)
- Martin Fowler's blog (patterns and architecture)
- High Scalability (how real companies scale)

### Courses
- "Grokking the System Design Interview" — DesignGuru.io
- "Complete NestJS Developer" — Udemy
- "Learn Go with Tests" — quii.gitbook.io (free)
- TechWorld with Nana — YouTube (Docker, K8s, monitoring)

---

## 🏆 Phase Completion Checklist

After each phase, verify:

### Phase 1 ✅
- [ ] Can explain how JWT auth works to a recruiter
- [ ] Can implement a basic rate limiter in a whiteboard interview
- [ ] Can describe the API Gateway pattern and its benefits
- [ ] Can explain S3 presigned URLs and multipart upload
- [ ] Can start all services with `docker compose up`

### Phase 2 ✅
- [ ] Can draw the CDN cache flow diagram from memory
- [ ] Can explain cache invalidation via pub/sub
- [ ] Can describe the difference between L1/L2/L3 cache hierarchy
- [ ] Can explain HTTP cache headers and their purpose
- [ ] Can answer "Design a CDN" in a system design interview

### Phase 3 ✅
- [ ] Can write a basic PromQL query
- [ ] Can explain the three pillars of observability
- [ ] Can describe how distributed tracing works
- [ ] Can set up a Grafana dashboard from scratch
- [ ] Can answer "How do you debug a slow request in microservices?"

### Phase 4 ✅
- [ ] Can explain Kafka topics, partitions, and consumer groups
- [ ] Can discuss trade-offs between Kafka and RabbitMQ
- [ ] Can implement an event-driven feature without direct service coupling
- [ ] Can answer "Design a notification system at scale"

### Phase 5 ✅
- [ ] Can write a K8s Deployment manifest from scratch
- [ ] Can explain how HPA works
- [ ] Can describe a zero-downtime deployment strategy
- [ ] Can answer "How do you scale a microservice system to handle 10x traffic?"

---

*This guide will be updated as new phases are completed.*

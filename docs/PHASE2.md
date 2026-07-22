# Phase 2 — CDN & Edge Architecture

## What was built

### CDN Service (Node.js/NestJS)
- Two-level cache: Redis (L1) + in-memory NodeCache (L2)
- Cache key format: cdn:{region}:{bucket}/{key}:{transformHash}
- Image optimization with Sharp: resize, WebP/AVIF conversion, quality control
- Geo-routing simulation: IP range → nearest region
- Distributed cache invalidation via Redis pub/sub
- Prometheus metrics: cache_hits, bandwidth, image_transforms

### Cache Service
- Centralized cache management API
- Purge by: file | bucket | prefix | all
- Audit log: last 100 purge operations
- Redis pub/sub broadcaster for distributed invalidation
- Auto-invalidate on file delete events

### Cache Flow
```
User Request
  ↓
API Gateway (L0 cache: 60s TTL)
  ↓ MISS
CDN Service (L1: Redis 3600s + L2: memory 300s)
  ↓ MISS  
Storage Service → MinIO
  ↓
Image Optimizer (if ?w=&fmt=&q= params)
  ↓
Store in L1+L2, return to user
```

### Cache Invalidation Flow
```
Admin triggers purge → Cache Service
  → Redis SCAN pattern matching
  → Batch DEL matching keys
  → PUBLISH cache:invalidate event
  → All CDN nodes receive + clear local memory cache
```

### Image CDN Usage
```
GET /cdn/my-bucket/image.jpg              # Original
GET /cdn/my-bucket/image.jpg?w=400        # Resize width to 400px
GET /cdn/my-bucket/image.jpg?w=400&h=300  # Resize to 400x300
GET /cdn/my-bucket/image.jpg?fmt=webp     # Convert to WebP  
GET /cdn/my-bucket/image.jpg?q=60         # 60% quality
GET /cdn/my-bucket/image.jpg?w=400&fmt=webp&q=80&fit=cover  # Combined
```

### Cache-Control Headers
```
X-Cache: HIT | MISS
X-Cache-Level: L1 | L2 | ORIGIN
X-Edge-Region: us-east-1 | eu-west-1 | ap-south-1
X-Cache-TTL: 3542 (seconds remaining)
Cache-Control: public, max-age=3600
ETag: "abc123"
Content-Type: image/webp
```

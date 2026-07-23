# EdgeSphere — Complete Setup Guide
> Step-by-step guide to run every service locally from scratch

---

## Table of Contents

1. [Prerequisites Installation](#1-prerequisites-installation)
2. [Project Setup](#2-project-setup)
3. [Phase 1 — Foundation](#3-phase-1--foundation)
4. [Phase 2 — CDN & Edge](#4-phase-2--cdn--edge)
5. [Phase 3 — Analytics & Notifications](#5-phase-3--analytics--notifications)
6. [Phase 4 — Resilience & Real-time](#6-phase-4--resilience--real-time)
7. [Phase 5 — Production](#7-phase-5--production)
8. [Verify Everything is Working](#8-verify-everything-is-working)
9. [Common Errors & Fixes](#9-common-errors--fixes)
10. [Quick Reference](#10-quick-reference)

---

## 1. Prerequisites Installation

> Yeh sab install karna hai pehle. Ek ek karke karo.

### 1.1 Homebrew (Mac package manager)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew --version
# Homebrew 4.x.x
```

### 1.2 Node.js v20
```bash
brew install node@20
echo 'export PATH="/opt/homebrew/opt/node@20/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
node --version   # v20.x.x
npm --version    # 10.x.x
```

### 1.3 pnpm (Package Manager)
```bash
npm install -g pnpm@9
pnpm --version   # 9.x.x
```

### 1.4 Docker Desktop
1. Go to: **https://www.docker.com/products/docker-desktop/**
2. Download **Docker Desktop for Mac** (Apple Silicon ya Intel)
3. Install karo (drag to Applications)
4. Open Docker Desktop from Applications
5. Wait jab tak menu bar mein whale icon aaye

```bash
docker --version          # Docker version 24.x.x
docker compose version    # Docker Compose version v2.x.x
```

### 1.5 Git
```bash
brew install git
git --version    # git version 2.x.x
```

### 1.6 Optional tools
```bash
brew install k6       # Load testing
brew install kubectl  # Kubernetes
brew install kind     # Local Kubernetes cluster
```

---

## 2. Project Setup

### 2.1 Open the project
```bash
cd /Users/yashkumarmeena/Desktop/Personal-DevelopMent/EdgeSphere
```

### 2.2 Install all dependencies (ek command!)
```bash
pnpm install
```
> Sab 10 services ka `node_modules` ek saath install hoga. 2-5 minutes lagenge.

### 2.3 Create .env files for every service
```bash
cp apps/auth-service/.env.example        apps/auth-service/.env
cp apps/gateway/.env.example             apps/gateway/.env
cp apps/storage-service/.env.example     apps/storage-service/.env
cp apps/analytics-service/.env.example   apps/analytics-service/.env
cp apps/cache-service/.env.example       apps/cache-service/.env
cp apps/cdn-service/.env.example         apps/cdn-service/.env
cp apps/notification-service/.env.example apps/notification-service/.env
cp apps/websocket-gateway/.env.example   apps/websocket-gateway/.env
```

### 2.4 Dashboard environment (manual banao)
```bash
cat > apps/dashboard/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3000/v1
NEXT_PUBLIC_WS_URL=http://localhost:3006
NEXT_PUBLIC_CDN_URL=http://localhost:8080
EOF
```

---

## 3. Phase 1 — Foundation

> Auth + API Gateway + Storage + Dashboard

### Step 1: Start Infrastructure (Docker)

**Terminal 1:**
```bash
cd /Users/yashkumarmeena/Desktop/Personal-DevelopMent/EdgeSphere

docker compose -f infra/docker/docker-compose.dev.yml up -d \
  postgres redis minio prometheus grafana jaeger loki
```

30 seconds wait karo, phir verify:
```bash
docker ps | grep edgesphere
```

Running hone chahiye:
```
edgesphere-postgres
edgesphere-redis
edgesphere-minio
edgesphere-prometheus
edgesphere-grafana
edgesphere-jaeger
```

### Step 2: Setup PostgreSQL Database

```bash
docker exec -it edgesphere-postgres psql -U edgesphere -d edgesphere
```

Psql prompt pe yeh SQL run karo:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS request_events (
  time        TIMESTAMPTZ NOT NULL,
  service     VARCHAR(50),
  method      VARCHAR(10),
  path        VARCHAR(500),
  status      SMALLINT,
  latency_ms  INTEGER,
  user_id     UUID,
  ip          INET,
  country     CHAR(2),
  cache_hit   BOOLEAN DEFAULT false,
  bytes       BIGINT DEFAULT 0,
  edge_region VARCHAR(20),
  request_id  UUID DEFAULT uuid_generate_v4()
);

SELECT create_hypertable('request_events', 'time', if_not_exists => TRUE);

\q
```

### Step 3: Setup MinIO Buckets

Browser mein open karo: **http://localhost:9001**
- Username: `minioadmin`
- Password: `minioadmin`

Click "Create Bucket" aur yeh banao:
1. `edgesphere-storage`
2. `test-cdn-bucket` (Public set karo)

Ya command se:
```bash
docker exec edgesphere-minio mc alias set local http://localhost:9000 minioadmin minioadmin
docker exec edgesphere-minio mc mb local/edgesphere-storage
docker exec edgesphere-minio mc mb local/test-cdn-bucket
docker exec edgesphere-minio mc anonymous set public local/test-cdn-bucket
```

### Step 4: Start Auth Service

**Terminal 2:**
```bash
cd apps/auth-service
pnpm dev
```
Wait for: `Application is running on: http://[::1]:3001`

Test:
```bash
curl http://localhost:3001/health
# {"status":"ok","service":"auth-service"}
```

### Step 5: Start API Gateway

**Terminal 3:**
```bash
cd apps/gateway
pnpm dev
```
Wait for port 3000.

Test:
```bash
curl http://localhost:3000/health
```

### Step 6: Start Storage Service

**Terminal 4:**
```bash
cd apps/storage-service
pnpm dev
```
Wait for port 3002.

### Step 7: Start Dashboard

**Terminal 5:**
```bash
cd apps/dashboard
pnpm install
pnpm dev
```
Wait for: `Local: http://localhost:3100`

### Step 8: Register Your First User

```bash
curl -X POST http://localhost:3000/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@edgesphere.local","password":"Admin1234!"}'
```

Response mein `accessToken` aayega. Phase 1 done!

Open **http://localhost:3100** — dashboard dikhega. ✅

---

## 4. Phase 2 — CDN & Edge

> CDN Edge Servers + Cache Service + Image Optimization

### Step 1: Start CDN Service — Edge A

**Terminal 6:**
```bash
cd apps/cdn-service

cat > .env << 'EOF'
NODE_ENV=development
PORT=8080
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_secret
ORIGIN_URL=http://localhost:3002
EDGE_REGION=us-east-1
CACHE_TTL_SECONDS=3600
MEMORY_CACHE_TTL_SECONDS=300
EOF

pnpm dev
```

If Sharp error aaye (Apple Silicon Mac):
```bash
npm install --platform=darwin --arch=arm64 sharp
```

### Step 2: Start CDN Service — Edge B

**Terminal 7:**
```bash
cd apps/cdn-service
PORT=8081 EDGE_REGION=eu-west-1 pnpm dev
```

### Step 3: Start Cache Service

**Terminal 8:**
```bash
cd apps/cache-service

cat > .env << 'EOF'
NODE_ENV=development
PORT=3004
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_secret
EOF

pnpm install
pnpm dev
```

### Step 4: Test CDN

```bash
# Login karo
TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@edgesphere.local","password":"Admin1234!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

# Bucket banao
curl -X POST http://localhost:3000/v1/storage/buckets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-bucket","isPublic":true}'

# Koi image upload karo
curl -X POST http://localhost:3000/v1/storage/buckets/my-bucket/files \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/any/photo.jpg" \
  -F "key=photo.jpg"

# CDN se serve (1st time = MISS)
curl -I http://localhost:8080/cdn/my-bucket/photo.jpg
# X-Cache: MISS

# 2nd request (HIT from Redis — ~2ms!)
curl -I http://localhost:8080/cdn/my-bucket/photo.jpg
# X-Cache: HIT

# WebP optimize karke serve karo
curl -o out.webp "http://localhost:8080/cdn/my-bucket/photo.jpg?w=400&fmt=webp&q=80"
```

Phase 2 done! ✅

---

## 5. Phase 3 — Analytics & Notifications

> Kafka + TimescaleDB Analytics + Email/Slack Alerts

### Step 1: Start Kafka + Zookeeper

```bash
docker compose -f infra/docker/docker-compose.dev.yml up -d kafka zookeeper
```

30 seconds wait:
```bash
docker logs edgesphere-kafka 2>&1 | tail -3
# "started (kafka.server.KafkaServer)"
```

### Step 2: Create Kafka Topics

```bash
KAFKA="docker exec edgesphere-kafka kafka-topics.sh --bootstrap-server localhost:9092"

$KAFKA --create --topic request.events    --partitions 3 --replication-factor 1
$KAFKA --create --topic storage.events    --partitions 3 --replication-factor 1
$KAFKA --create --topic alerts.triggered  --partitions 1 --replication-factor 1
$KAFKA --create --topic system.events     --partitions 1 --replication-factor 1
$KAFKA --create --topic request.events.dlq --partitions 1 --replication-factor 1

# Verify
$KAFKA --list
```

### Step 3: Start Analytics Service

**Terminal 9:**
```bash
cd apps/analytics-service

cat > .env << 'EOF'
NODE_ENV=development
PORT=3003
DB_HOST=localhost
DB_PORT=5432
DB_USER=edgesphere
DB_PASSWORD=edgesphere_secret
DB_NAME=edgesphere
KAFKA_BROKER=localhost:9092
KAFKA_CLIENT_ID=analytics-service
KAFKA_GROUP_ID=analytics-group
LOG_LEVEL=info
EOF

pnpm install
pnpm dev
```

Test:
```bash
curl http://localhost:3003/analytics/summary?window=60
```

### Step 4: Start Notification Service

**Terminal 10:**
```bash
cd apps/notification-service

cat > .env << 'EOF'
NODE_ENV=development
PORT=3005
KAFKA_BROKER=localhost:9092
KAFKA_CLIENT_ID=notification-service
KAFKA_GROUP_ID=notification-group
ANALYTICS_SERVICE_URL=http://localhost:3003
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_FROM=alerts@edgesphere.local
ALERT_EMAIL_TO=admin@edgesphere.local
ALERT_CHECK_INTERVAL_SECONDS=60
ALERT_DEBOUNCE_MINUTES=10
LOG_LEVEL=info
EOF

pnpm install
pnpm dev
```

### Step 5: Analytics Flow Test

```bash
# 20 requests generate karo
for i in $(seq 1 20); do curl -s http://localhost:3000/health > /dev/null; done

sleep 5  # Kafka process kare

# Analytics dekho
curl "http://localhost:3003/analytics/summary?window=60"
# {"totalRequests":20,"avgLatency":12,...}
```

Phase 3 done! ✅

---

## 6. Phase 4 — Resilience & Real-time

> Circuit Breaker + WebSocket + OAuth2 + Multipart Upload

### Step 1: Start WebSocket Gateway

**Terminal 11:**
```bash
cd apps/websocket-gateway

cat > .env << 'EOF'
NODE_ENV=development
PORT=3006
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_secret
KAFKA_BROKER=localhost:9092
KAFKA_CLIENT_ID=websocket-gateway
KAFKA_GROUP_ID=websocket-group
LOG_LEVEL=info
EOF

pnpm install
pnpm dev
```

### Step 2: WebSocket Test (Browser Console)

http://localhost:3100 kholo, F12 press karo, Console mein:
```javascript
const { io } = await import('https://cdn.socket.io/4.7.2/socket.io.esm.min.js');
const socket = io('http://localhost:3006/realtime');
socket.on('connect', () => console.log('Connected!', socket.id));
socket.emit('subscribe', ['metrics', 'events']);
socket.on('metrics_update', m => console.log('Metrics:', m));
socket.on('request_event', e => console.log('Event:', e.method, e.path));
```

### Step 3: OAuth2 — Google Login (Optional)

**Google Cloud Console setup:**
1. https://console.cloud.google.com → New Project "EdgeSphere"
2. APIs & Services → Credentials → Create OAuth 2.0 Client ID
3. Application type: **Web application**
4. Authorized redirect URIs: `http://localhost:3001/auth/oauth/google/callback`
5. Copy Client ID + Secret

```bash
# apps/auth-service/.env mein add karo:
GOOGLE_CLIENT_ID=paste-your-client-id-here
GOOGLE_CLIENT_SECRET=paste-your-client-secret-here
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/oauth/google/callback
FRONTEND_URL=http://localhost:3100
```

Auth service restart, phir test: http://localhost:3001/auth/oauth/google

### Step 4: OAuth2 — GitHub Login (Optional)

**GitHub Setup:**
1. https://github.com/settings/developers → OAuth Apps → New OAuth App
2. Homepage URL: `http://localhost:3100`
3. Authorization callback URL: `http://localhost:3001/auth/oauth/github/callback`

```bash
# apps/auth-service/.env mein add karo:
GITHUB_CLIENT_ID=paste-here
GITHUB_CLIENT_SECRET=paste-here
GITHUB_CALLBACK_URL=http://localhost:3001/auth/oauth/github/callback
```

### Step 5: Test Circuit Breaker

```bash
# All circuit breakers ka status
curl http://localhost:3000/resilience/circuit-breakers

# Enhanced health (with upstream latency)
curl http://localhost:3000/health

# Kubernetes probes
curl http://localhost:3000/health/ready
curl http://localhost:3000/health/live
```

### Step 6: Test Multipart Upload

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@edgesphere.local","password":"Admin1234!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

# 50MB file ke liye initiate karo
UPLOAD=$(curl -s -X POST http://localhost:3000/v1/storage/multipart/initiate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bucket":"my-bucket","key":"big-file.mp4","contentType":"video/mp4","totalSize":52428800}')

echo $UPLOAD
# {"uploadId":"uuid-here","partCount":10,"partSize":5242880}

UPLOAD_ID=$(echo $UPLOAD | python3 -c "import sys,json; print(json.load(sys.stdin)['uploadId'])")

# Status check karo
curl "http://localhost:3000/v1/storage/multipart/$UPLOAD_ID" -H "Authorization: Bearer $TOKEN"

# Abort karo (cleanup)
curl -X DELETE "http://localhost:3000/v1/storage/multipart/$UPLOAD_ID" \
  -H "Authorization: Bearer $TOKEN"
```

Phase 4 done! ✅

---

## 7. Phase 5 — Production

### Option A: Full Docker Compose (Sabse Easy)

```bash
cd /Users/yashkumarmeena/Desktop/Personal-DevelopMent/EdgeSphere

# Root .env file banao
cat > .env << 'EOF'
DB_PASSWORD=edgesphere_secret
REDIS_PASSWORD=redis_secret
JWT_SECRET=super-secret-jwt-key-minimum-32-characters-long
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
EOF

# Sab start karo
bash scripts/start.sh
```

Pehli baar Docker images build hongi — 10-20 min lagenge.

### Option B: Kubernetes (kind — local cluster)

```bash
# kind install karo
brew install kind

# Cluster create karo
kind create cluster --name edgesphere
kubectl cluster-info --context kind-edgesphere

# Secrets file setup karo
cp k8s/base/secrets.yaml k8s/base/secrets.local.yaml
# File kholo aur REPLACE_ME replace karo real values se:
open k8s/base/secrets.local.yaml

# Dry run preview
bash scripts/k8s-deploy.sh dev --dry-run

# Actually deploy karo
bash scripts/k8s-deploy.sh dev

# Port forward karo (access ke liye)
kubectl port-forward svc/dashboard 3100:3100 -n edgesphere &
kubectl port-forward svc/gateway 3000:3000 -n edgesphere &

# Open
open http://localhost:3100
```

K8s monitoring:
```bash
kubectl get pods -n edgesphere       # Sab pods dekho
kubectl get hpa -n edgesphere        # HPA status
kubectl logs -l app=gateway -n edgesphere --tail=20  # Gateway logs
```

### Option C: k6 Load Tests

```bash
brew install k6

# 1. Smoke test (30 sec, sabse pehle)
k6 run tests/load/01-smoke-test.js

# 2. Auth load test
k6 run tests/load/02-auth-load.js --env BASE_URL=http://localhost:3000

# 3. CDN load (cache hit ratio test)
k6 run tests/load/03-cdn-load.js --env CDN_URL=http://localhost:8080

# 4. Full platform (1000 req/sec target!)
k6 run tests/load/05-full-platform.js \
  --env BASE_URL=http://localhost:3000 \
  --env CDN_URL=http://localhost:8080
```

### Option D: Grafana Dashboard Setup

1. http://localhost:3200 kholo
2. Login: `admin` / `admin`
3. Left menu → Connections → Add data source
4. **Prometheus** select karo
5. URL: `http://prometheus:9090` → Save
6. Left menu → Dashboards → Import
7. `infra/grafana/dashboards/edgesphere-main.json` file select karo → Import

Phase 5 done! ✅

---

## 8. Verify Everything is Working

### All-in-one check script

```bash
echo "=== EdgeSphere Health Check ==="
services=(
  "3000:API Gateway"
  "3001:Auth Service"
  "3002:Storage Service"
  "3003:Analytics"
  "3004:Cache Service"
  "3005:Notifications"
  "3006:WebSocket Gateway"
  "8080:CDN Edge A"
  "8081:CDN Edge B"
  "3100:Dashboard"
)

for entry in "${services[@]}"; do
  port="${entry%%:*}"
  name="${entry##*:}"
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/health 2>/dev/null || echo "ERR")
  if [ "$code" = "200" ]; then
    echo "  ✅ $name (port $port)"
  else
    echo "  ❌ $name (port $port) — HTTP $code"
  fi
done
```

### Run phase-specific tests

```bash
bash scripts/test-phase2.sh  # CDN + Cache tests
bash scripts/test-phase3.sh  # Kafka + Analytics tests
bash scripts/test-phase4.sh  # Circuit Breaker + OAuth + Multipart tests
```

---

## 9. Common Errors & Fixes

### pnpm command not found
```bash
npm install -g pnpm@9
```

### Cannot connect to Docker daemon
Docker Desktop open nahi hai. Applications se Docker open karo, whale icon wait karo.

### Port already in use (EADDRINUSE :::3001)
```bash
kill -9 $(lsof -ti:3001)
# Ya specific port ke liye:
kill -9 $(lsof -ti:3002)
```

### PostgreSQL connection refused (ECONNREFUSED 5432)
```bash
docker compose -f infra/docker/docker-compose.dev.yml up -d postgres
docker logs edgesphere-postgres
```

### Redis connection refused (ECONNREFUSED 6379)
```bash
docker compose -f infra/docker/docker-compose.dev.yml up -d redis
```

### Kafka connection failed (KafkaJSNumberOfRetriesExceeded)
```bash
docker compose -f infra/docker/docker-compose.dev.yml up -d kafka zookeeper
sleep 30
# Phir topics banao (Section 5, Step 2)
```

### Module not found: @edgesphere/shared
```bash
cd /Users/yashkumarmeena/Desktop/Personal-DevelopMent/EdgeSphere
pnpm install
```

### Sharp error on Apple Silicon Mac
```bash
cd apps/cdn-service
npm install --platform=darwin --arch=arm64 sharp
```

### MinIO connection error
```bash
docker compose -f infra/docker/docker-compose.dev.yml up -d minio
sleep 10
# Buckets banao (Section 3, Step 3)
```

### Dashboard .env.local missing
```bash
cat > apps/dashboard/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3000/v1
NEXT_PUBLIC_WS_URL=http://localhost:3006
NEXT_PUBLIC_CDN_URL=http://localhost:8080
EOF
```

### TypeScript errors
```bash
cd apps/<service-name>
pnpm typecheck
```

---

## 10. Quick Reference

### All Service URLs

| Service | URL | Login |
|---------|-----|-------|
| Dashboard | http://localhost:3100 | Register pehle karo |
| API Gateway | http://localhost:3000 | — |
| Auth Service | http://localhost:3001 | — |
| Storage Service | http://localhost:3002 | — |
| Analytics | http://localhost:3003 | — |
| Cache Service | http://localhost:3004 | — |
| Notifications | http://localhost:3005 | — |
| WebSocket | ws://localhost:3006 | — |
| CDN Edge A | http://localhost:8080 | — |
| CDN Edge B | http://localhost:8081 | — |
| Grafana | http://localhost:3200 | admin / admin |
| Prometheus | http://localhost:9090 | — |
| Jaeger | http://localhost:16686 | — |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin |

### Default Passwords (.env files)

| Service | Value |
|---------|-------|
| PostgreSQL password | `edgesphere_secret` |
| Redis password | `redis_secret` |
| MinIO user | `minioadmin` |
| MinIO password | `minioadmin` |
| JWT Secret | `your-super-secret-jwt-key-change-in-production-min-32-chars` |

### Key Scripts

| Script | Kab Use Karo |
|--------|--------------|
| `bash scripts/start.sh` | Sab kuch ek saath Docker mein start |
| `bash scripts/start.sh --infra-only` | Sirf databases/kafka/monitoring |
| `bash scripts/start.sh --stop` | Sab band karo |
| `bash scripts/test-phase4.sh` | Phase 4 verify karo |
| `bash scripts/k8s-deploy.sh dev` | Kubernetes deploy |
| `bash scripts/tf-deploy.sh prod plan` | Terraform plan |
| `k6 run tests/load/01-smoke-test.js` | Quick smoke test |

### Important File Locations

| File | Kya Hai |
|------|---------|
| `infra/docker/docker-compose.dev.yml` | Sab Docker services |
| `apps/*/.env.example` | Har service ka env template |
| `k8s/` | Kubernetes manifests (30 files) |
| `terraform/` | AWS infrastructure code |
| `.github/workflows/ci.yml` | CI/CD pipeline |
| `tests/load/` | k6 load test scripts |
| `docs/PHASE*.md` | Har phase ka detail |

---

*EdgeSphere Setup Guide — Phase 1 to Phase 5 | July 2026*

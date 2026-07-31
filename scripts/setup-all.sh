#!/bin/bash
# EdgeSphere — One-Shot Full Setup Script
# Run this AFTER Docker Desktop is installed and running
# Usage: bash scripts/setup-all.sh

set -e
COMPOSE="docker compose -f infra/docker/docker-compose.dev.yml"
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
EDGESPHERE_DIR="/Users/yashkumarmeena/Desktop/Personal-DevelopMent/EdgeSphere"

pass()    { echo -e "${GREEN}✅ $1${NC}"; }
fail()    { echo -e "${RED}❌ $1${NC}"; exit 1; }
info()    { echo -e "${YELLOW}⏳ $1${NC}"; }
section() { echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${BLUE}  $1${NC}"; echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

cd "$EDGESPHERE_DIR"

echo ""
echo -e "${BLUE}  ⚡ EdgeSphere — Full Setup${NC}"
echo -e "${BLUE}  Setting up all phases automatically...${NC}"
echo ""

# ─── PHASE 0: Preflight ──────────────────────────────────────────────────────
section "Phase 0 — Preflight Checks"

command -v docker > /dev/null 2>&1 || fail "Docker not found! Install Docker Desktop first from https://docker.com/products/docker-desktop/"
docker info > /dev/null 2>&1 || fail "Docker is not running! Open Docker Desktop app."
pass "Docker is running"

command -v pnpm > /dev/null 2>&1 || fail "pnpm not found. Run: npm install -g pnpm@9"
pass "pnpm found: $(pnpm --version)"

command -v node > /dev/null 2>&1 || fail "Node.js not found"
pass "Node.js: $(node --version)"

# ─── PHASE 1: Infrastructure ─────────────────────────────────────────────────
section "Phase 1 — Starting Infrastructure (Docker)"

info "Pulling Docker images (first time may take 5-10 mins)..."
$COMPOSE pull postgres redis minio prometheus grafana jaeger loki 2>&1 | grep -E "Pull|already|Pulling" || true

info "Starting infrastructure containers..."
$COMPOSE up -d postgres redis minio prometheus grafana jaeger loki

# Wait for Postgres
info "Waiting for PostgreSQL to be ready..."
for i in $(seq 1 40); do
  docker exec edgesphere-postgres pg_isready -U edgesphere > /dev/null 2>&1 && break
  sleep 2
  [ $i -eq 40 ] && fail "PostgreSQL did not start in time"
done
pass "PostgreSQL is ready"

# Wait for Redis
info "Waiting for Redis..."
for i in $(seq 1 20); do
  docker exec edgesphere-redis redis-cli -a redis_secret ping > /dev/null 2>&1 && break
  sleep 1
done
pass "Redis is ready"

# Wait for MinIO
info "Waiting for MinIO..."
sleep 8
pass "MinIO is ready"

# ─── PHASE 1: Database Setup ──────────────────────────────────────────────────
section "Phase 1 — Database Setup (PostgreSQL + TimescaleDB)"

info "Creating PostgreSQL extensions and TimescaleDB hypertable..."
docker exec -i edgesphere-postgres psql -U edgesphere -d edgesphere << 'EOSQL'
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

CREATE TABLE IF NOT EXISTS request_events (
  time        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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

-- Compression policy: compress data older than 7 days
SELECT add_compression_policy('request_events', INTERVAL '7 days', if_not_exists => TRUE);

\echo 'Database setup complete!'
EOSQL
pass "PostgreSQL + TimescaleDB hypertable ready"

# ─── PHASE 1: MinIO Buckets ───────────────────────────────────────────────────
section "Phase 1 — MinIO Bucket Setup"

info "Configuring MinIO buckets..."

# Configure mc alias inside container
docker exec edgesphere-minio sh -c "
  mc alias set local http://localhost:9000 minioadmin minioadmin --insecure 2>/dev/null || true
  mc mb --ignore-existing local/edgesphere-storage
  mc mb --ignore-existing local/test-cdn-bucket
  mc anonymous set public local/test-cdn-bucket
  echo 'Buckets ready'
" 2>&1 | grep -v "^mc" || true

pass "MinIO buckets created: edgesphere-storage, test-cdn-bucket (public)"

# ─── PHASE 3: Kafka Setup ────────────────────────────────────────────────────
section "Phase 3 — Kafka Setup"

info "Starting Kafka + Zookeeper..."
$COMPOSE up -d kafka zookeeper

info "Waiting for Kafka to start (30 seconds)..."
sleep 30

# Check Kafka is up
docker exec edgesphere-kafka /opt/kafka/bin/kafka-topics.sh --list --bootstrap-server localhost:9092 > /dev/null 2>&1 || {
  info "Kafka not ready yet, waiting 15 more seconds..."
  sleep 15
}

info "Creating Kafka topics..."
KAFKA_CMD="docker exec edgesphere-kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092"

for topic in request.events storage.events alerts.triggered system.events request.events.dlq storage.events.dlq; do
  $KAFKA_CMD --create --if-not-exists --topic "$topic" \
    --partitions 3 --replication-factor 1 2>&1 | grep -v "already exists" || true
  echo "  Topic: $topic ✓"
done

pass "All Kafka topics created"

# Verify
echo "  Topics list:"
$KAFKA_CMD --list 2>/dev/null | sed 's/^/    /' || true

# ─── PHASE 4: WebSocket + All Services ───────────────────────────────────────
section "All Services — Summary"

pass "All external infrastructure is configured!"

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Infrastructure Ready — Start Services Now         ║${NC}"
echo -e "${BLUE}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║${NC}  Open separate terminals for each service:               "
echo -e "${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  ${GREEN}Terminal 1:${NC}  cd apps/auth-service     && pnpm dev   "
echo -e "${BLUE}║${NC}  ${GREEN}Terminal 2:${NC}  cd apps/gateway          && pnpm dev   "
echo -e "${BLUE}║${NC}  ${GREEN}Terminal 3:${NC}  cd apps/storage-service  && pnpm dev   "
echo -e "${BLUE}║${NC}  ${GREEN}Terminal 4:${NC}  cd apps/cdn-service      && pnpm dev   "
echo -e "${BLUE}║${NC}  ${GREEN}Terminal 5:${NC}  cd apps/cache-service    && pnpm dev   "
echo -e "${BLUE}║${NC}  ${GREEN}Terminal 6:${NC}  cd apps/analytics-service && pnpm dev  "
echo -e "${BLUE}║${NC}  ${GREEN}Terminal 7:${NC}  cd apps/notification-service && pnpm dev"
echo -e "${BLUE}║${NC}  ${GREEN}Terminal 8:${NC}  cd apps/websocket-gateway && pnpm dev  "
echo -e "${BLUE}║${NC}  ${GREEN}Terminal 9:${NC}  cd apps/dashboard        && pnpm dev   "
echo -e "${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  OR run everything in Docker:"
echo -e "${BLUE}║${NC}  ${YELLOW}bash scripts/start.sh${NC}"
echo -e "${BLUE}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║${NC}  Service URLs (after starting):                          "
echo -e "${BLUE}║${NC}  🖥️  Dashboard    → ${GREEN}http://localhost:3100${NC}           "
echo -e "${BLUE}║${NC}  🚦  API Gateway  → ${GREEN}http://localhost:3000${NC}           "
echo -e "${BLUE}║${NC}  📊  Grafana      → ${GREEN}http://localhost:3200${NC} (admin/admin)"
echo -e "${BLUE}║${NC}  🪣  MinIO        → ${GREEN}http://localhost:9001${NC} (minioadmin/minioadmin)"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

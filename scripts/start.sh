#!/bin/bash
# EdgeSphere — Quick Start Script (Phase 2)
# Usage: bash scripts/start.sh [--dev | --infra-only | --stop]

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

COMPOSE_FILE="infra/docker/docker-compose.dev.yml"

banner() {
  echo ""
  echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║        ⚡  EdgeSphere Platform  ⚡               ║${NC}"
  echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
  echo ""
}

case "$1" in
  "--stop")
    banner
    echo -e "${YELLOW}Stopping all services...${NC}"
    docker compose -f "$COMPOSE_FILE" down
    echo -e "${GREEN}✓ All services stopped${NC}"
    ;;

  "--infra-only")
    banner
    echo -e "${YELLOW}Starting infrastructure only (DB, Redis, MinIO, Kafka, Monitoring)...${NC}"
    docker compose -f "$COMPOSE_FILE" up postgres redis minio kafka prometheus grafana jaeger loki -d
    echo ""
    echo -e "${GREEN}✓ Infrastructure ready!${NC}"
    echo ""
    echo "  🗄️  PostgreSQL  → localhost:5432"
    echo "  ⚡  Redis       → localhost:6379"
    echo "  📦  MinIO       → http://localhost:9000  (admin/minio_secret_123)"
    echo "  📨  Kafka       → localhost:9092"
    echo "  📈  Grafana     → http://localhost:3200  (admin/grafana_secret)"
    echo "  🔥  Prometheus  → http://localhost:9090"
    echo "  🔍  Jaeger      → http://localhost:16686"
    echo ""
    echo -e "${YELLOW}Now run services individually:${NC}"
    echo "  cd apps/auth-service    && pnpm dev"
    echo "  cd apps/gateway         && pnpm dev"
    echo "  cd apps/storage-service && pnpm dev"
    echo "  cd apps/cdn-service     && pnpm dev"
    echo "  cd apps/cache-service   && pnpm dev"
    echo "  cd apps/dashboard       && pnpm dev"
    ;;

  "--dev"|*)
    banner
    echo -e "${YELLOW}Starting ALL EdgeSphere services...${NC}"
    echo ""

    # Start infra first
    echo -e "${BLUE}[1/3] Starting infrastructure...${NC}"
    docker compose -f "$COMPOSE_FILE" up postgres redis minio kafka -d

    # Wait for postgres
    echo -e "${BLUE}[2/3] Waiting for PostgreSQL to be ready...${NC}"
    timeout 30 bash -c 'until docker compose -f infra/docker/docker-compose.dev.yml exec -T postgres pg_isready -U edgesphere; do sleep 1; done' 2>/dev/null || true

    # Start monitoring
    docker compose -f "$COMPOSE_FILE" up prometheus grafana jaeger loki -d 2>/dev/null || true

    echo -e "${BLUE}[3/3] Starting application services...${NC}"
    docker compose -f "$COMPOSE_FILE" up gateway auth-service storage-service cdn-service-a cdn-service-b cache-service dashboard -d 2>/dev/null || true

    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║          EdgeSphere is running!  🚀              ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "  📊  Dashboard      → http://localhost:3100"
    echo "  🚦  API Gateway    → http://localhost:3000"
    echo "  🔐  Auth Service   → http://localhost:3001"
    echo "  🗄️  Storage        → http://localhost:3002"
    echo "  🌐  CDN Edge A     → http://localhost:8080 (us-east-1)"
    echo "  🌐  CDN Edge B     → http://localhost:8081 (eu-west-1)"
    echo "  💊  Cache Service  → http://localhost:3004"
    echo ""
    echo "  📈  Grafana        → http://localhost:3200"
    echo "  🔥  Prometheus     → http://localhost:9090"
    echo "  🔍  Jaeger         → http://localhost:16686"
    echo "  📦  MinIO Console  → http://localhost:9001"
    echo ""
    echo -e "${YELLOW}Run tests: bash scripts/test-phase2.sh${NC}"
    echo -e "${YELLOW}Stop all:  bash scripts/start.sh --stop${NC}"
    echo ""
    ;;
esac

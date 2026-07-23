#!/bin/bash
# EdgeSphere — Platform Startup Script (All Phases)
# Usage: bash scripts/start.sh [--infra-only] [--apps-only] [--help]
set -e

COMPOSE_FILE="infra/docker/docker-compose.dev.yml"
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

print_banner() {
  echo ""
  echo -e "${BLUE}  ███████╗██████╗  ██████╗ ███████╗███████╗██████╗ ██╗  ██╗███████╗██████╗ ███████╗${NC}"
  echo -e "${BLUE}  ██╔════╝██╔══██╗██╔════╝ ██╔════╝██╔════╝██╔══██╗██║  ██║██╔════╝██╔══██╗██╔════╝${NC}"
  echo -e "${CYAN}  █████╗  ██║  ██║██║  ███╗█████╗  ███████╗██████╔╝███████║█████╗  ██████╔╝█████╗  ${NC}"
  echo -e "${CYAN}  ██╔══╝  ██║  ██║██║   ██║██╔══╝  ╚════██║██╔═══╝ ██╔══██║██╔══╝  ██╔══██╗██╔══╝  ${NC}"
  echo -e "${GREEN}  ███████╗██████╔╝╚██████╔╝███████╗███████║██║     ██║  ██║███████╗██║  ██║███████╗${NC}"
  echo -e "${GREEN}  ╚══════╝╚═════╝  ╚═════╝ ╚══════╝╚══════╝╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝${NC}"
  echo ""
  echo -e "${YELLOW}  ⚡ Self-hosted Cloud Platform | CDN + Storage + Analytics + Gateway${NC}"
  echo ""
}

usage() {
  echo "Usage: bash scripts/start.sh [OPTION]"
  echo ""
  echo "Options:"
  echo "  --infra-only    Start only infrastructure (postgres, redis, minio, kafka, monitoring)"
  echo "  --apps-only     Start only application services"
  echo "  --stop          Stop all services"
  echo "  --logs          Follow logs for all services"
  echo "  --status        Show running services status"
  echo "  --help          Show this help"
  echo ""
}

start_infra() {
  echo -e "${YELLOW}→ Starting infrastructure services...${NC}"
  docker compose -f $COMPOSE_FILE up -d \
    postgres redis minio kafka zookeeper \
    prometheus grafana jaeger loki
  echo -e "${GREEN}✓ Infrastructure started${NC}"
}

start_apps() {
  echo -e "${YELLOW}→ Starting application services...${NC}"
  docker compose -f $COMPOSE_FILE up -d \
    auth-service gateway storage-service \
    analytics-service cache-service cdn-service-a cdn-service-b \
    notification-service websocket-gateway dashboard
  echo -e "${GREEN}✓ Applications started${NC}"
}

wait_for_infra() {
  echo -e "${YELLOW}→ Waiting for infrastructure to be ready...${NC}"
  
  # Wait for Postgres
  echo -n "  Postgres "
  for i in $(seq 1 30); do
    docker compose -f $COMPOSE_FILE exec -T postgres pg_isready -U edgesphere > /dev/null 2>&1 && break
    echo -n "."
    sleep 2
  done
  echo " ✓"
  
  # Wait for Redis
  echo -n "  Redis    "
  for i in $(seq 1 20); do
    docker compose -f $COMPOSE_FILE exec -T redis redis-cli ping > /dev/null 2>&1 && break
    echo -n "."
    sleep 1
  done
  echo " ✓"

  # Wait for Kafka
  echo -n "  Kafka    "
  sleep 15  # Kafka takes time
  echo " ✓"
}

print_urls() {
  echo ""
  echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║          EdgeSphere — Service URLs           ║${NC}"
  echo -e "${BLUE}╠══════════════════════════════════════════════╣${NC}"
  echo -e "${BLUE}║${NC}  🖥️  Dashboard      → ${GREEN}http://localhost:3100${NC}"
  echo -e "${BLUE}║${NC}  🚦  API Gateway    → ${GREEN}http://localhost:3000${NC}"
  echo -e "${BLUE}║${NC}  🔐  Auth Service   → ${GREEN}http://localhost:3001${NC}"
  echo -e "${BLUE}║${NC}  🗄️  Storage        → ${GREEN}http://localhost:3002${NC}"
  echo -e "${BLUE}║${NC}  📈  Analytics      → ${GREEN}http://localhost:3003${NC}"
  echo -e "${BLUE}║${NC}  💊  Cache Service  → ${GREEN}http://localhost:3004${NC}"
  echo -e "${BLUE}║${NC}  🔔  Notifications  → ${GREEN}http://localhost:3005${NC}"
  echo -e "${BLUE}║${NC}  🔌  WebSocket      → ${GREEN}ws://localhost:3006${NC}"
  echo -e "${BLUE}║${NC}  🌐  CDN Edge A     → ${GREEN}http://localhost:8080${NC}"
  echo -e "${BLUE}║${NC}  🌐  CDN Edge B     → ${GREEN}http://localhost:8081${NC}"
  echo -e "${BLUE}╠══════════════════════════════════════════════╣${NC}"
  echo -e "${BLUE}║${NC}  📊  Grafana        → ${GREEN}http://localhost:3200${NC} (admin/admin)"
  echo -e "${BLUE}║${NC}  🔥  Prometheus     → ${GREEN}http://localhost:9090${NC}"
  echo -e "${BLUE}║${NC}  🔍  Jaeger         → ${GREEN}http://localhost:16686${NC}"
  echo -e "${BLUE}║${NC}  🪣  MinIO Console  → ${GREEN}http://localhost:9001${NC}"
  echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
  echo ""
}

# ─── Main ─────────────────────────────────────────────────────────────────────

print_banner

case "${1:-}" in
  --help)
    usage
    exit 0
    ;;
  --stop)
    echo -e "${YELLOW}→ Stopping all EdgeSphere services...${NC}"
    docker compose -f $COMPOSE_FILE down
    echo -e "${GREEN}✓ All services stopped${NC}"
    exit 0
    ;;
  --logs)
    docker compose -f $COMPOSE_FILE logs -f
    exit 0
    ;;
  --status)
    docker compose -f $COMPOSE_FILE ps
    exit 0
    ;;
  --infra-only)
    start_infra
    wait_for_infra
    print_urls
    ;;
  --apps-only)
    start_apps
    print_urls
    ;;
  *)
    start_infra
    wait_for_infra
    start_apps
    print_urls
    echo -e "${GREEN}✓ EdgeSphere platform fully started!${NC}"
    echo ""
    ;;
esac

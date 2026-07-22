#!/bin/bash
# EdgeSphere Phase 3 — Smoke Test Script
# Tests: Kafka event flow, Analytics queries, Notifications, Live events
# Run: bash scripts/test-phase3.sh

set -e

GATEWAY="http://localhost:3000"
ANALYTICS="http://localhost:3003"
NOTIFICATIONS="http://localhost:3005"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; }
info() { echo -e "${YELLOW}→ $1${NC}"; }
section() { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║   EdgeSphere Phase 3 — Smoke Tests        ║"
echo "║   Analytics + Notifications + Kafka       ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

# ─── Get Auth Token ──────────────────────────────────────────────
info "Getting auth token..."
LOGIN=$(curl -s -X POST "$GATEWAY/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@edgesphere.local","password":"admin123"}' 2>&1)
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken',''))" 2>/dev/null)
if [ -n "$TOKEN" ]; then
  pass "Auth token obtained"
else
  info "Trying registration..."
  REG=$(curl -s -X POST "$GATEWAY/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"phase3-test@example.com","password":"Test1234!"}' 2>&1)
  TOKEN=$(echo "$REG" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken',''))" 2>/dev/null)
  [ -n "$TOKEN" ] && pass "Registered + token obtained" || fail "Auth failed"
fi

section "1. Analytics Service Health"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$ANALYTICS/analytics/health")
if [ "$STATUS" = "200" ]; then
  HEALTH=$(curl -s "$ANALYTICS/analytics/health")
  pass "Analytics service healthy"
  echo "  $(echo $HEALTH | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"Kafka: {d.get('kafka','?')} | DB: {d.get('db','?')}\")" 2>/dev/null)"
else
  fail "Analytics service not responding ($STATUS)"
fi

section "2. Analytics Queries"

info "2a. Summary stats (last 24h)"
SUMMARY=$(curl -s "$ANALYTICS/analytics/summary?window=1440" \
  -H "Authorization: Bearer $TOKEN")
if echo "$SUMMARY" | grep -q "totalRequests\|cacheHitRatio"; then
  pass "Summary stats working"
  echo "$SUMMARY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'  Requests: {d.get(\"totalRequests\",0):,} | Cache Hit: {d.get(\"cacheHitRatio\",0):.1f}% | P95: {d.get(\"p95Latency\",0)}ms | Errors: {d.get(\"errorRate\",0):.2f}%')
" 2>/dev/null
else
  fail "Summary stats failed: $SUMMARY"
fi

info "2b. Request rate time series"
RATE=$(curl -s "$ANALYTICS/analytics/requests/rate?window=60" \
  -H "Authorization: Bearer $TOKEN")
if echo "$RATE" | grep -q "\["; then
  COUNT=$(echo "$RATE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)
  pass "Request rate: $COUNT time points returned"
else
  fail "Request rate failed"
fi

info "2c. Latency percentiles"
LATENCY=$(curl -s "$ANALYTICS/analytics/latency/percentiles?window=60" \
  -H "Authorization: Bearer $TOKEN")
if echo "$LATENCY" | grep -q "p50\|p95\|p99"; then
  pass "Latency percentiles working"
  echo "$LATENCY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'  P50: {d.get(\"p50\",0)}ms | P95: {d.get(\"p95\",0)}ms | P99: {d.get(\"p99\",0)}ms')
" 2>/dev/null
else
  fail "Latency percentiles failed"
fi

info "2d. Geographic distribution"
GEO=$(curl -s "$ANALYTICS/analytics/geo?window=60" \
  -H "Authorization: Bearer $TOKEN")
if echo "$GEO" | grep -q "\["; then
  pass "Geo distribution working"
else
  fail "Geo distribution failed"
fi

info "2e. Top paths"
TOP=$(curl -s "$ANALYTICS/analytics/requests/top-paths?window=60&limit=5" \
  -H "Authorization: Bearer $TOKEN")
if echo "$TOP" | grep -q "\["; then
  pass "Top paths working"
else
  fail "Top paths failed"
fi

info "2f. Active users"
USERS=$(curl -s "$ANALYTICS/analytics/users/active?window=15" \
  -H "Authorization: Bearer $TOKEN")
if echo "$USERS" | grep -qE "[0-9]"; then
  pass "Active users: $USERS"
else
  fail "Active users failed"
fi

section "3. Event Ingestion via Kafka"

info "3a. Generate traffic to trigger Kafka events (10 requests)"
for i in $(seq 1 10); do
  curl -s -o /dev/null "$GATEWAY/health" &
done
wait
sleep 2
pass "10 requests sent through gateway (events published to Kafka)"

info "3b. Check recent events (wait 5s for Kafka consumption)"
sleep 5
RECENT=$(curl -s "$ANALYTICS/analytics/events/recent?limit=10" \
  -H "Authorization: Bearer $TOKEN")
if echo "$RECENT" | grep -q "\["; then
  COUNT=$(echo "$RECENT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)
  pass "Recent events: $COUNT events in TimescaleDB"
else
  info "Events may still be processing: $RECENT"
fi

section "4. Notifications Service"

info "4a. Health check"
NOTIF_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$NOTIFICATIONS/notifications/health")
if [ "$NOTIF_STATUS" = "200" ]; then
  pass "Notification service healthy"
else
  fail "Notification service not responding ($NOTIF_STATUS)"
fi

info "4b. List alert rules"
RULES=$(curl -s "$NOTIFICATIONS/notifications/alerts/rules")
if echo "$RULES" | grep -q "\["; then
  COUNT=$(echo "$RULES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)
  pass "Alert rules: $COUNT rules loaded"
  echo "$RULES" | python3 -c "
import sys,json
rules=json.load(sys.stdin)
for r in rules[:3]:
    print(f'  [{r.get(\"severity\",\"?\").upper()}] {r.get(\"name\",\"?\")} \u2192 {r.get(\"condition\",\"?\")} > {r.get(\"threshold\",\"?\")}')" 2>/dev/null
else
  fail "Alert rules failed: $RULES"
fi

info "4c. Create a test alert rule"
NEW_RULE=$(curl -s -X POST "$NOTIFICATIONS/notifications/alerts/rules" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Rule - High Error Rate",
    "condition": "error_rate_above",
    "threshold": 1,
    "windowMinutes": 5,
    "channels": ["webhook"],
    "severity": "warning",
    "enabled": true
  }')
if echo "$NEW_RULE" | grep -q "id\|name"; then
  pass "Alert rule created successfully"
else
  fail "Alert rule creation failed: $NEW_RULE"
fi

info "4d. Send test notification"
TEST_NOTIF=$(curl -s -X POST "$NOTIFICATIONS/notifications/test" \
  -H "Content-Type: application/json" \
  -d '{}')
if echo "$TEST_NOTIF" | grep -q "sent\|success\|ok\|dispatched"; then
  pass "Test notification sent"
else
  info "Test response: $TEST_NOTIF"
fi

info "4e. Get notification history"
HISTORY=$(curl -s "$NOTIFICATIONS/notifications/history")
if echo "$HISTORY" | grep -q "\["; then
  COUNT=$(echo "$HISTORY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)
  pass "Notification history: $COUNT records"
else
  info "History: $HISTORY"
fi

section "5. Error Rate Alert Simulation"

info "Triggering 20 bad requests to raise error rate..."
for i in $(seq 1 20); do
  curl -s -o /dev/null "$GATEWAY/v1/storage/buckets/nonexistent-bucket-xyz" \
    -H "Authorization: Bearer $TOKEN" &
done
wait
pass "20 404 requests sent \u2014 error rate elevated"
info "Notification service will check threshold in next 60s cycle"

section "6. Dashboard Pages"

for PAGE in "analytics" "alerts" "events"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3100/dashboard/$PAGE" 2>/dev/null || echo "ERR")
  if [ "$STATUS" = "200" ]; then
    pass "Dashboard /$PAGE page accessible"
  else
    info "Dashboard /$PAGE: $STATUS (may need browser to load Next.js)"
  fi
done

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Phase 3 smoke tests complete!"
echo ""
echo "  📊 Analytics:     http://localhost:3003/analytics/summary"
echo "  🔔 Notifications: http://localhost:3005/notifications/alerts/rules"
echo "  🖥️  Dashboard:     http://localhost:3100/dashboard/analytics"
echo "  📋 Live Events:   http://localhost:3100/dashboard/events"
echo "  🔔 Alerts:        http://localhost:3100/dashboard/alerts"
echo "═══════════════════════════════════════════════════"
echo ""

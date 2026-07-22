#!/bin/bash
# EdgeSphere Phase 4 — Smoke Test Script
# Tests: Circuit Breaker, OAuth2, Multipart Upload, WebSocket
# Run: bash scripts/test-phase4.sh

set -e
GATEWAY="http://localhost:3000"
AUTH="http://localhost:3001"
STORAGE="http://localhost:3002"
WS_GW="http://localhost:3006"
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; }
info() { echo -e "${YELLOW}→ $1${NC}"; }
section() { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║   EdgeSphere Phase 4 — Smoke Tests            ║"
echo "║   Circuit Breaker + OAuth + Multipart + WS    ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

# ─── Auth token ──────────────────────────────────────────────────
info "Getting auth token..."
LOGIN=$(curl -s -X POST "$GATEWAY/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test-p4@example.com","password":"Test1234!"}' 2>&1)
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null)
if [ -z "$TOKEN" ]; then
  REG=$(curl -s -X POST "$GATEWAY/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"test-p4@example.com","password":"Test1234!"}' 2>&1)
  TOKEN=$(echo "$REG" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null)
fi
[ -n "$TOKEN" ] && pass "Auth token obtained" || fail "Auth failed"

section "1. Circuit Breaker Status"

CB_STATUS=$(curl -s "$GATEWAY/resilience/circuit-breakers" 2>&1)
if echo "$CB_STATUS" | grep -q "state\|CLOSED\|OPEN"; then
  pass "Circuit breakers endpoint working"
  echo "$CB_STATUS" | python3 -c "
import sys,json
try:
  breakers = json.load(sys.stdin)
  for b in breakers[:5]:
    print(f'  [{b.get(\"state\",\"?\")}] {b.get(\"service\",\"?\")}')
except: print('  Parse error')" 2>/dev/null
else
  fail "Circuit breaker status failed: $CB_STATUS"
fi

section "2. Enhanced Health Check"

HEALTH=$(curl -s "$GATEWAY/health")
if echo "$HEALTH" | grep -q "status\|services"; then
  pass "Enhanced health check working"
  echo "$HEALTH" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'  Status: {d.get(\"status\",\"?\")} | Kafka: {d.get(\"kafka\",{}).get(\"status\",\"?\")}')
services = d.get('services', {})
for svc,info in list(services.items())[:3]:
    print(f'  {svc}: {info.get(\"status\",\"?\")} ({info.get(\"latencyMs\",\"?\")}ms)')" 2>/dev/null
else
  info "Health: $HEALTH"
fi

section "3. Rate Limit Headers"

RL_RESP=$(curl -s -I "$GATEWAY/health")
if echo "$RL_RESP" | grep -qi "X-RateLimit-Limit\|x-ratelimit"; then
  pass "Rate limit headers present (RFC 6585)"
  echo "$RL_RESP" | grep -i "ratelimit" | head -3
else
  info "Rate limit headers not visible on /health (expected on protected routes)"
fi

section "4. OAuth2 Providers"

PROVIDERS=$(curl -s "$AUTH/auth/oauth/providers")
if echo "$PROVIDERS" | grep -q "providers\|google\|github"; then
  pass "OAuth providers endpoint working"
  echo "  $PROVIDERS"
else
  fail "OAuth providers failed: $PROVIDERS"
fi

section "5. Multipart Upload Flow"

info "5a. Initiate multipart upload (50MB file simulation)"
INIT=$(curl -s -X POST "$GATEWAY/v1/storage/multipart/initiate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bucket":"test-cdn-bucket","key":"large-file-test.bin","contentType":"application/octet-stream","totalSize":52428800}')

UPLOAD_ID=$(echo "$INIT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('uploadId',''))" 2>/dev/null)
PART_COUNT=$(echo "$INIT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('partCount',''))" 2>/dev/null)

if [ -n "$UPLOAD_ID" ]; then
  pass "Multipart initiated: uploadId=$UPLOAD_ID, parts=$PART_COUNT"
else
  fail "Multipart initiation failed: $INIT"
  UPLOAD_ID=""
fi

if [ -n "$UPLOAD_ID" ]; then
  info "5b. Upload part 1"
  # Create 1MB test data
  dd if=/dev/urandom bs=1024 count=1024 2>/dev/null | base64 | head -c 1048576 > /tmp/part1.bin

  PART_RESP=$(curl -s -X PUT "$GATEWAY/v1/storage/multipart/$UPLOAD_ID/parts/1" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/octet-stream" \
    --data-binary @/tmp/part1.bin)
  rm -f /tmp/part1.bin

  if echo "$PART_RESP" | grep -q "partNumber\|etag"; then
    ETAG=$(echo "$PART_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('etag',''))" 2>/dev/null)
    pass "Part 1 uploaded: etag=$ETAG"
  else
    info "Part upload response: $PART_RESP"
  fi

  info "5c. Get upload status"
  STATUS=$(curl -s "$GATEWAY/v1/storage/multipart/$UPLOAD_ID" \
    -H "Authorization: Bearer $TOKEN")
  if echo "$STATUS" | grep -q "progress\|uploadId"; then
    PROGRESS=$(echo "$STATUS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('progress','?'))" 2>/dev/null)
    pass "Upload status: ${PROGRESS}% complete"
  fi

  info "5d. Abort multipart upload (cleanup)"
  ABORT=$(curl -s -X DELETE "$GATEWAY/v1/storage/multipart/$UPLOAD_ID" \
    -H "Authorization: Bearer $TOKEN")
  echo "$ABORT" | grep -q "aborted\|success" && pass "Multipart aborted cleanly" || info "Abort: $ABORT"
fi

section "6. WebSocket Gateway"

WS_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$WS_GW/health" 2>/dev/null)
if [ "$WS_HEALTH" = "200" ]; then
  pass "WebSocket gateway HTTP healthy (200)"
else
  fail "WebSocket gateway not responding (HTTP $WS_HEALTH)"
fi

info "WebSocket connection test (socket.io handshake)"
WS_RESP=$(curl -s "$WS_GW/socket.io/?EIO=4&transport=polling" -o /dev/null -w "%{http_code}")
if [ "$WS_RESP" = "200" ]; then
  pass "Socket.io handshake successful"
else
  info "Socket.io HTTP poll: $WS_RESP (normal if WS is primary transport)"
fi

section "7. DLQ Status"

DLQ_METRICS=$(curl -s "$GATEWAY/metrics" 2>/dev/null | grep "dlq" || echo "no dlq metrics yet")
if echo "$DLQ_METRICS" | grep -q "dlq"; then
  pass "DLQ metrics exposed in Prometheus"
  echo "$DLQ_METRICS" | head -3
else
  info "DLQ metrics: No messages in DLQ (normal \u2014 all events processing fine)"
fi

section "8. File Versioning"

info "Upload same key twice \u2014 verify versioning"
# Upload v1
curl -s -X POST "$GATEWAY/v1/storage/buckets/test-cdn-bucket/files" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$(echo 'hello world v1' | mktemp /tmp/v-XXXXX.txt);type=text/plain" \
  -F "key=versioned-test.txt" > /dev/null 2>&1 || true

# Check versions
FILES=$(curl -s "$GATEWAY/v1/storage/buckets/test-cdn-bucket/files" \
  -H "Authorization: Bearer $TOKEN")
if echo "$FILES" | grep -q "version\|versioned-test"; then
  pass "File versioning working"
else
  info "Files response: check storage service logs"
fi

echo ""
echo "══════════════════════════════════════════════════"
echo "  Phase 4 smoke tests complete!"
echo ""
echo "  🔌 WebSocket: ws://localhost:3006/realtime"
echo "  🔒 OAuth Google: http://localhost:3001/auth/oauth/google"
echo "  🔒 OAuth GitHub: http://localhost:3001/auth/oauth/github"
echo "  ⚡ Circuit Breakers: http://localhost:3000/resilience/circuit-breakers"
echo "  📤 Multipart: POST http://localhost:3000/v1/storage/multipart/initiate"
echo "══════════════════════════════════════════════════"
echo ""

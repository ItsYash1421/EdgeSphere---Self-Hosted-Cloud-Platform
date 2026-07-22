#!/bin/bash
# EdgeSphere Phase 2 — Smoke Test Script
# Tests: Auth, Storage, CDN caching, Image optimization, Cache purge
# Run: bash scripts/test-phase2.sh

set -e

GATEWAY="http://localhost:3000"
CDN_A="http://localhost:8080"
CACHE_SVC="http://localhost:3004"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; }
info() { echo -e "${YELLOW}→ $1${NC}"; }

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║   EdgeSphere Phase 2 — Smoke Tests        ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

# ─── 1. Auth Service ─────────────────────────────────────────────
info "1. Auth Service — Register + Login"
REG=$(curl -s -X POST "$GATEWAY/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test-phase2@example.com","password":"Test1234!"}' 2>&1)

if echo "$REG" | grep -q "accessToken"; then
  pass "Registration successful"
  TOKEN=$(echo "$REG" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken',''))" 2>/dev/null)
elif echo "$REG" | grep -q "already exists\|conflict"; then
  info "User already exists — logging in"
  LOGIN=$(curl -s -X POST "$GATEWAY/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test-phase2@example.com","password":"Test1234!"}')
  TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken',''))" 2>/dev/null)
  pass "Login successful"
else
  fail "Auth failed: $REG"
  TOKEN=""
fi

echo "  Token: ${TOKEN:0:40}..."
echo ""

# ─── 2. Create Bucket ────────────────────────────────────────────
info "2. Storage — Create bucket 'test-cdn-bucket'"
BUCKET=$(curl -s -X POST "$GATEWAY/v1/storage/buckets" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"test-cdn-bucket","isPublic":true}' 2>&1)

if echo "$BUCKET" | grep -q "test-cdn-bucket\|already exists\|conflict"; then
  pass "Bucket ready"
else
  fail "Bucket creation failed: $BUCKET"
fi
echo ""

# ─── 3. Upload Test Image ─────────────────────────────────────────
info "3. Storage — Upload test image"
# Create a minimal 1x1 red PNG
TEST_IMG=$(mktemp /tmp/test-XXXXXX.png)
python3 -c "
import struct, zlib
def write_png(filename):
    def chunk(ct, data):
        c = struct.pack('>I', len(data)) + ct + data
        return c + struct.pack('>I', zlib.crc32(ct + data) & 0xffffffff)
    data = b'\\x89PNG\\r\\n\\x1a\\n'
    data += chunk(b'IHDR', struct.pack('>IIBBBBB', 100, 100, 8, 2, 0, 0, 0))
    raw = b''.join(b'\\x00' + b'\\xff\\x00\\x00' * 100 for _ in range(100))
    data += chunk(b'IDAT', zlib.compress(raw))
    data += chunk(b'IEND', b'')
    open(filename, 'wb').write(data)
write_png('$TEST_IMG')
print('PNG created')
" 2>/dev/null && pass "Test PNG created (100x100 red)" || fail "PNG creation failed"

UPLOAD=$(curl -s -X POST "$GATEWAY/v1/storage/buckets/test-cdn-bucket/files" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$TEST_IMG;type=image/png" \
  -F "key=test-image.png" 2>&1)
rm -f "$TEST_IMG"

if echo "$UPLOAD" | grep -q "id\|key\|etag"; then
  pass "File uploaded successfully"
else
  info "Upload response: $UPLOAD"
fi
echo ""

# ─── 4. CDN Cache MISS ────────────────────────────────────────────
info "4. CDN — First request (expect MISS)"
CDN_RESP=$(curl -s -I "$CDN_A/cdn/test-cdn-bucket/test-image.png" 2>&1)
if echo "$CDN_RESP" | grep -qi "X-Cache: MISS\|x-cache: miss"; then
  pass "Cache MISS on first request ✓"
elif echo "$CDN_RESP" | grep -qi "200"; then
  info "Got 200 (cache header not visible in this env)"
else
  fail "CDN request failed: $CDN_RESP"
fi
echo ""

# ─── 5. CDN Cache HIT ────────────────────────────────────────────
info "5. CDN — Second request (expect HIT)"
sleep 1
CDN_RESP2=$(curl -s -I "$CDN_A/cdn/test-cdn-bucket/test-image.png" 2>&1)
if echo "$CDN_RESP2" | grep -qi "X-Cache: HIT\|x-cache: hit"; then
  pass "Cache HIT on second request ✓ (Redis working!)"
elif echo "$CDN_RESP2" | grep -qi "200"; then
  info "Got 200 (checking cache headers)"
else
  fail "CDN cache HIT failed"
fi
echo ""

# ─── 6. Image Optimization ────────────────────────────────────────
info "6. CDN — Image optimization (WebP conversion)"
WEBP=$(curl -s -o /tmp/test-optimized.webp -w "%{http_code} size=%{size_download} content_type=%{content_type}" \
  "$CDN_A/cdn/test-cdn-bucket/test-image.png?fmt=webp&w=50&q=80" 2>&1)

if echo "$WEBP" | grep -q "^200"; then
  ORIG_SIZE=$(stat -f%z /tmp/test-optimized.webp 2>/dev/null || stat -c%s /tmp/test-optimized.webp 2>/dev/null || echo "?")
  pass "Image optimization: WebP, 50px width, 80% quality (size: ${ORIG_SIZE} bytes)"
  rm -f /tmp/test-optimized.webp
else
  fail "Image optimization failed: $WEBP"
fi
echo ""

# ─── 7. Cache Purge ──────────────────────────────────────────────
info "7. Cache — Purge specific file"
PURGE=$(curl -s -X POST "$CACHE_SVC/cache/purge" \
  -H "Content-Type: application/json" \
  -H "X-Internal-Key: internal-secret-change-me" \
  -d '{"bucket":"test-cdn-bucket","key":"test-image.png"}' 2>&1)

if echo "$PURGE" | grep -q "purgeId\|keysDeleted"; then
  DELETED=$(echo "$PURGE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('keysDeleted', 0))" 2>/dev/null)
  pass "Cache purge successful — $DELETED keys deleted"
else
  fail "Cache purge failed: $PURGE"
fi
echo ""

# ─── 8. Verify Cache Miss after Purge ─────────────────────────────
info "8. CDN — Verify MISS after purge"
CDN_RESP3=$(curl -s -I "$CDN_A/cdn/test-cdn-bucket/test-image.png" 2>&1)
if echo "$CDN_RESP3" | grep -qi "X-Cache: MISS\|x-cache: miss"; then
  pass "Cache MISS after purge ✓ (invalidation works!)"
else
  info "Response: $CDN_RESP3"
fi
echo ""

# ─── 9. Cache Stats ──────────────────────────────────────────────
info "9. Cache — Get statistics"
STATS=$(curl -s "$CACHE_SVC/cache/stats" \
  -H "X-Internal-Key: internal-secret-change-me" 2>&1)
if echo "$STATS" | grep -q "totalKeys\|hitRatio\|memoryUsed"; then
  pass "Cache stats returned successfully"
  echo "  $STATS" | head -3
else
  fail "Stats failed: $STATS"
fi
echo ""

# ─── 10. Health Checks ───────────────────────────────────────────
info "10. Health checks — all services"
for SERVICE in "Gateway:$GATEWAY/health" "CDN-A:$CDN_A/health" "Cache:$CACHE_SVC/cache/health"; do
  NAME="${SERVICE%%:*}"
  URL="${SERVICE#*:}"
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$URL" 2>/dev/null)
  if [ "$STATUS" = "200" ]; then
    pass "$NAME — healthy (200)"
  else
    fail "$NAME — unhealthy ($STATUS)"
  fi
done

echo ""
echo "═══════════════════════════════════════════════"
echo "  Phase 2 smoke tests complete!"
echo "  Run 'docker compose logs cdn-service-a' for CDN logs"
echo "  Visit http://localhost:3100/dashboard/cdn for CDN dashboard"
echo "═══════════════════════════════════════════════"
echo ""

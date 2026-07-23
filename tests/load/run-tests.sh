#!/bin/bash
# Run all k6 load tests in sequence
set -e

echo '=== EdgeSphere Load Tests ==='
echo ''

BASE_URL=${BASE_URL:-http://localhost:3000}
CDN_URL=${CDN_URL:-http://localhost:8080}

echo '1. Smoke test (30s)...'
k6 run tests/load/01-smoke-test.js --env BASE_URL=$BASE_URL --env CDN_URL=$CDN_URL

echo '2. CDN load test (3m)...'
k6 run tests/load/03-cdn-load.js --env CDN_URL=$CDN_URL --out json=results/cdn-load.json

echo '3. Auth load test (3.5m)...'
k6 run tests/load/02-auth-load.js --env BASE_URL=$BASE_URL --out json=results/auth-load.json

echo '4. Full platform test (5m target: 1000 req/sec)...'
k6 run tests/load/05-full-platform.js --env BASE_URL=$BASE_URL --env CDN_URL=$CDN_URL --out json=results/platform.json

echo ''
echo '=== All load tests complete! ==='
echo 'Results saved to tests/load/results/'

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Gauge } from 'k6/metrics';
import { CDN_URL } from './config.js';

const cacheHitRate = new Rate('cache_hit_ratio');
const cachedLatency = new Trend('cdn_cached_latency', true);
const uncachedLatency = new Trend('cdn_uncached_latency', true);

export const options = {
  scenarios: {
    // Constant load: 200 VUs for 3 minutes
    constant_cdn_load: {
      executor: 'constant-vus',
      vus: 200,
      duration: '3m',
    },
    // Spike test: sudden 500 VU spike
    cdn_spike: {
      executor: 'ramping-vus',
      startTime: '1m',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 500 },
        { duration: '30s', target: 500 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    'cache_hit_ratio': ['rate>0.8'],                    // >80% cache hit
    'cdn_cached_latency': ['p(95)<50', 'p(99)<100'],    // <50ms cached
    'cdn_uncached_latency': ['p(95)<500'],              // <500ms uncached
    'http_req_failed': ['rate<0.01'],                   // <1% errors
  },
};

// Test file keys (assume pre-uploaded)
const TEST_FILES = [
  'test-cdn-bucket/assets/hero.webp',
  'test-cdn-bucket/assets/logo.svg',
  'test-cdn-bucket/css/main.css',
  'test-cdn-bucket/js/bundle.js',
  'test-cdn-bucket/images/background.jpg',
];

export default function() {
  // 80% of requests go to a small set of hot files (simulate real traffic)
  const isHotFile = Math.random() < 0.8;
  const fileKey = isHotFile
    ? TEST_FILES[Math.floor(Math.random() * 3)]  // top 3 files are "hot"
    : TEST_FILES[Math.floor(Math.random() * TEST_FILES.length)];
  
  group('CDN file serving', () => {
    const start = Date.now();
    const res = http.get(`${CDN_URL}/cdn/${fileKey}`);
    const duration = Date.now() - start;
    
    const isHit = res.headers['X-Cache'] === 'HIT';
    cacheHitRate.add(isHit);
    
    if (isHit) {
      cachedLatency.add(duration);
    } else {
      uncachedLatency.add(duration);
    }
    
    check(res, {
      'cdn status 200': r => r.status === 200,
      'has cache header': r => r.headers['X-Cache'] !== undefined,
      'has etag': r => r.headers['ETag'] !== undefined,
    });
  });
  
  group('Image optimization', () => {
    const imageKey = 'test-cdn-bucket/images/background.jpg';
    
    // WebP conversion
    const webpRes = http.get(`${CDN_URL}/cdn/${imageKey}?fmt=webp&w=400&q=80`);
    check(webpRes, {
      'webp conversion ok': r => r.status === 200,
      'content is webp': r => r.headers['Content-Type'] === 'image/webp',
    });
    
    // Resize
    const resizeRes = http.get(`${CDN_URL}/cdn/${imageKey}?w=100&h=100&fit=cover`);
    check(resizeRes, { 'resize ok': r => r.status === 200 });
  });
  
  sleep(Math.random() * 0.5);
}

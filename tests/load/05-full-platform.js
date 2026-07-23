import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { SharedArray } from 'k6/data';
import { BASE_URL, CDN_URL, ANALYTICS_URL } from './config.js';

export const options = {
  scenarios: {
    // Sustained 1000 req/sec target
    platform_load: {
      executor: 'constant-arrival-rate',
      rate: 1000,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 200,
      maxVUs: 1000,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function() {
  const rand = Math.random();
  
  if (rand < 0.6) {
    // 60% CDN requests (most common)
    http.get(`${CDN_URL}/cdn/test-cdn-bucket/assets/hero.webp`);
  } else if (rand < 0.8) {
    // 20% API requests
    http.get(`${BASE_URL}/health`);
  } else if (rand < 0.95) {
    // 15% analytics
    http.get(`${ANALYTICS_URL}/analytics/summary?window=60`);
  } else {
    // 5% auth
    http.get(`${BASE_URL}/v1/auth/health`);
  }
  
  sleep(0.001); // minimal sleep for high throughput
}

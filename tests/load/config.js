export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
export const CDN_URL = __ENV.CDN_URL || 'http://localhost:8080';
export const AUTH_URL = __ENV.AUTH_URL || 'http://localhost:3001';
export const ANALYTICS_URL = __ENV.ANALYTICS_URL || 'http://localhost:3003';

// Test users for load tests
export const TEST_USERS = [
  { email: 'loadtest1@example.com', password: 'LoadTest1234!' },
  { email: 'loadtest2@example.com', password: 'LoadTest1234!' },
  { email: 'loadtest3@example.com', password: 'LoadTest1234!' },
];

export const THRESHOLDS = {
  // API Gateway
  'http_req_duration{type:api}': ['p(95)<200', 'p(99)<500'],
  // CDN cached responses
  'http_req_duration{type:cdn_cached}': ['p(95)<50', 'p(99)<100'],
  // CDN uncached (origin fetch)
  'http_req_duration{type:cdn_uncached}': ['p(95)<500'],
  // Error rate < 1%
  'http_req_failed': ['rate<0.01'],
  // Cache hit ratio > 80%
  'cache_hit_ratio': ['rate>0.8'],
};

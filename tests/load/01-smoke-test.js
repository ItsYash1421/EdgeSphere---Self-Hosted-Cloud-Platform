import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, CDN_URL } from './config.js';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export default function() {
  // Test 1: Gateway health
  let res = http.get(`${BASE_URL}/health`);
  check(res, { 'gateway healthy': r => r.status === 200 });
  
  // Test 2: Auth endpoint reachable
  res = http.get(`${BASE_URL}/v1/auth/health`);
  check(res, { 'auth healthy': r => r.status === 200 });
  
  // Test 3: CDN health
  res = http.get(`${CDN_URL}/health`);
  check(res, { 'cdn healthy': r => r.status === 200 });
  
  sleep(1);
}

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { BASE_URL, TEST_USERS } from './config.js';

const loginSuccess = new Rate('login_success');
const loginDuration = new Trend('login_duration', true);
const tokenRefreshes = new Counter('token_refreshes');

export const options = {
  scenarios: {
    // Ramp up to 50 concurrent users
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 100 },
        { duration: '1m', target: 100 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    login_success: ['rate>0.99'],
    login_duration: ['p(95)<300', 'p(99)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function() {
  const user = TEST_USERS[__VU % TEST_USERS.length];
  
  group('Login flow', () => {
    const loginStart = Date.now();
    
    const loginRes = http.post(
      `${BASE_URL}/v1/auth/login`,
      JSON.stringify({ email: user.email, password: user.password }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    loginDuration.add(Date.now() - loginStart);
    
    const loginOk = check(loginRes, {
      'login status 200': r => r.status === 200,
      'has access token': r => r.json('accessToken') !== undefined,
      'has refresh token': r => r.json('refreshToken') !== undefined,
    });
    loginSuccess.add(loginOk);
    
    if (!loginOk) { sleep(1); return; }
    
    const { accessToken, refreshToken } = loginRes.json();
    
    group('Authenticated requests', () => {
      // Get profile
      const profileRes = http.get(
        `${BASE_URL}/v1/auth/me`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      check(profileRes, { 'profile 200': r => r.status === 200 });
      
      // List buckets
      const bucketsRes = http.get(
        `${BASE_URL}/v1/storage/buckets`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      check(bucketsRes, { 'buckets 200': r => r.status === 200 });
    });
    
    group('Token refresh', () => {
      const refreshRes = http.post(
        `${BASE_URL}/v1/auth/refresh`,
        JSON.stringify({ refreshToken }),
        { headers: { 'Content-Type': 'application/json' } }
      );
      check(refreshRes, { 'refresh 200': r => r.status === 200 });
      tokenRefreshes.add(1);
    });
  });
  
  sleep(Math.random() * 2 + 1);
}

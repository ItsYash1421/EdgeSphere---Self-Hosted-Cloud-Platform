import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL } from './config.js';

const uploadsTotal = new Counter('files_uploaded');
const downloadTotal = new Counter('files_downloaded');
const uploadDuration = new Trend('upload_duration', true);

export const options = {
  scenarios: {
    upload_load: {
      executor: 'constant-vus',
      vus: 20,
      duration: '2m',
    },
  },
  thresholds: {
    'upload_duration': ['p(95)<2000'],  // uploads < 2s for small files
    'http_req_failed': ['rate<0.02'],
  },
};

// Pre-shared auth token (set via env)
const TOKEN = __ENV.AUTH_TOKEN || 'test-token';
const BUCKET = 'load-test-bucket';

// 1KB test file content
const TEST_FILE_CONTENT = new Uint8Array(1024).fill(65); // 1KB of 'A'

export default function() {
  group('File upload', () => {
    const fileName = `load-test-${__VU}-${Date.now()}.txt`;
    const formData = {
      file: http.file(TEST_FILE_CONTENT, fileName, 'text/plain'),
      key: fileName,
    };
    
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/v1/storage/buckets/${BUCKET}/files`,
      formData,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    uploadDuration.add(Date.now() - start);
    
    const ok = check(res, {
      'upload 201': r => r.status === 201 || r.status === 200,
      'has file id': r => r.json('id') !== undefined,
    });
    if (ok) uploadsTotal.add(1);
  });
  
  sleep(Math.random() * 1 + 0.5);
}

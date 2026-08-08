import { Test, TestingModule } from '@nestjs/testing';
import { RateLimitService } from './rate-limit.service';
import { MetricsService } from '../metrics/metrics.service';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';

const mockPipelineExec = jest.fn();
const mockPipeline = {
  zadd: jest.fn().mockReturnThis(),
  zremrangebyscore: jest.fn().mockReturnThis(),
  zcard: jest.fn().mockReturnThis(),
  expire: jest.fn().mockReturnThis(),
  exec: mockPipelineExec,
};
const mockRedis = {
  hmget: jest.fn(),
  hmset: jest.fn(),
  expire: jest.fn(),
  pipeline: jest.fn(() => mockPipeline),
};
const mockMetrics = { recordRateLimitHit: jest.fn() };

describe('RateLimitService', () => {
  let service: RateLimitService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitService,
        { provide: getRedisConnectionToken(), useValue: mockRedis },
        { provide: MetricsService, useValue: mockMetrics },
      ],
    }).compile();
    service = module.get<RateLimitService>(RateLimitService);
  });

  describe('tokenBucket', () => {
    it('allows first request when bucket is full (no prior state)', async () => {
      mockRedis.hmget.mockResolvedValue([null, null]);
      mockRedis.hmset.mockResolvedValue('OK');
      mockRedis.expire.mockResolvedValue(1);

      const result = await service.tokenBucket('user-1', 100, 10);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
    });

    it('rejects when tokens are exactly 0', async () => {
      const now = Date.now();
      mockRedis.hmget.mockResolvedValue(['0', String(now)]);
      mockRedis.hmset.mockResolvedValue('OK');
      mockRedis.expire.mockResolvedValue(1);

      const result = await service.tokenBucket('user-2', 100, 10);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(mockMetrics.recordRateLimitHit).toHaveBeenCalledWith('token_bucket');
    });

    it('refills tokens correctly based on elapsed time', async () => {
      const past = Date.now() - 5000; // 5 seconds ago → +50 tokens at 10/sec
      mockRedis.hmget.mockResolvedValue(['0', String(past)]);
      mockRedis.hmset.mockResolvedValue('OK');
      mockRedis.expire.mockResolvedValue(1);

      const result = await service.tokenBucket('user-3', 100, 10);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(49);
    });

    it('clamps token refill to capacity maximum', async () => {
      const past = Date.now() - 9999000; // ancient → would overflow without clamp
      mockRedis.hmget.mockResolvedValue(['0', String(past)]);
      mockRedis.hmset.mockResolvedValue('OK');
      mockRedis.expire.mockResolvedValue(1);

      const result = await service.tokenBucket('user-4', 100, 10);

      expect(result.remaining).toBe(99); // clamped to capacity-1 after deduction
    });

    it('allows request when tokens are exactly 1 (boundary)', async () => {
      const now = Date.now();
      mockRedis.hmget.mockResolvedValue(['1', String(now)]);
      mockRedis.hmset.mockResolvedValue('OK');
      mockRedis.expire.mockResolvedValue(1);

      const result = await service.tokenBucket('user-5', 100, 10);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('does not record metric hit on allowed requests', async () => {
      mockRedis.hmget.mockResolvedValue([null, null]);
      mockRedis.hmset.mockResolvedValue('OK');
      mockRedis.expire.mockResolvedValue(1);

      await service.tokenBucket('user-6', 100, 10);

      expect(mockMetrics.recordRateLimitHit).not.toHaveBeenCalled();
    });
  });

  describe('slidingWindow', () => {
    it('allows request when count is under limit', async () => {
      mockPipelineExec.mockResolvedValue([[null, 1], [null, 0], [null, 5], [null, 1]]);

      const result = await service.slidingWindow('ip-1', 100, 60000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(95);
    });

    it('rejects request when count exceeds limit', async () => {
      mockPipelineExec.mockResolvedValue([[null, 1], [null, 0], [null, 101], [null, 1]]);

      const result = await service.slidingWindow('ip-2', 100, 60000);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(mockMetrics.recordRateLimitHit).toHaveBeenCalledWith('sliding_window');
    });

    it('allows request when count is exactly at limit', async () => {
      mockPipelineExec.mockResolvedValue([[null, 1], [null, 0], [null, 100], [null, 1]]);

      const result = await service.slidingWindow('ip-3', 100, 60000);

      expect(result.allowed).toBe(true); // count == limit, not count > limit
    });

    it('handles Redis pipeline exec failure gracefully', async () => {
      mockPipelineExec.mockResolvedValue(null);

      const result = await service.slidingWindow('ip-4', 100, 60000);

      expect(result.allowed).toBe(true); // fails open, not closed
    });

    it('calculates remaining correctly when count is 0', async () => {
      mockPipelineExec.mockResolvedValue([[null, 1], [null, 0], [null, 0], [null, 1]]);

      const result = await service.slidingWindow('ip-5', 100, 60000);

      expect(result.remaining).toBe(100);
    });
  });
});

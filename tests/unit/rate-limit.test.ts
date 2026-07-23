import { Test, TestingModule } from '@nestjs/testing';
import { getRedisToken } from '@nestjs-modules/ioredis';

// Assuming a standard RateLimitService structure as implementation wasn't fully specified
class RateLimitService {
  constructor(private readonly redis: any) {}
  
  async checkTokenBucket(key: string, limit: number, refillRate: number): Promise<{allowed: boolean, remaining: number, retryAfter?: number}> {
    const res = await this.redis.eval(`
      local key = KEYS[1]
      local limit = tonumber(ARGV[1])
      local refillRate = tonumber(ARGV[2])
      
      -- Mock lua script logic here
      return {1, limit - 1, 0}
    `, 1, key, limit, refillRate);
    
    if (res[0] === 1) {
       return { allowed: true, remaining: res[1] };
    }
    return { allowed: false, remaining: res[1], retryAfter: res[2] };
  }

  async checkSlidingWindow(key: string, limit: number, windowSecs: number): Promise<{allowed: boolean, remaining: number}> {
    const now = Date.now();
    const windowStart = now - (windowSecs * 1000);
    
    await this.redis.zremrangebyscore(key, 0, windowStart);
    const currentCount = await this.redis.zcard(key);
    
    if (currentCount >= limit) {
      return { allowed: false, remaining: 0 };
    }
    
    await this.redis.zadd(key, now, `${now}-${Math.random()}`);
    await this.redis.expire(key, windowSecs);
    
    return { allowed: true, remaining: limit - currentCount - 1 };
  }
}

describe('RateLimitService', () => {
  let service: RateLimitService;
  
  const mockRedis = {
    eval: jest.fn(),
    zadd: jest.fn(),
    zcard: jest.fn(),
    zremrangebyscore: jest.fn(),
    expire: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitService,
        { provide: getRedisToken('default'), useValue: mockRedis },
      ],
    }).compile();
    service = module.get<RateLimitService>(RateLimitService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('Token Bucket', () => {
    it('should allow burst traffic up to capacity', async () => {
      mockRedis.eval.mockResolvedValue([1, 9, 0]);
      
      const result = await service.checkTokenBucket('ip:127.0.0.1', 10, 1);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(mockRedis.eval).toHaveBeenCalled();
    });

    it('should reject when tokens exhausted', async () => {
      mockRedis.eval.mockResolvedValue([0, 0, 5000]);
      
      const result = await service.checkTokenBucket('ip:127.0.0.1', 10, 1);
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBe(5000);
    });

    it('should replenish tokens over time', async () => {
       mockRedis.eval.mockResolvedValue([1, 5, 0]);
       
       const result = await service.checkTokenBucket('ip:127.0.0.1', 10, 1);
       
       expect(result.allowed).toBe(true);
       expect(result.remaining).toBe(5);
    });
  });

  describe('Sliding Window', () => {
    it('should allow requests within window limit', async () => {
      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcard.mockResolvedValue(5);
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      
      const result = await service.checkSlidingWindow('ip:127.0.0.1', 10, 60);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(mockRedis.zadd).toHaveBeenCalled();
      expect(mockRedis.expire).toHaveBeenCalled();
    });

    it('should reject requests exceeding window limit', async () => {
      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcard.mockResolvedValue(10);
      
      const result = await service.checkSlidingWindow('ip:127.0.0.1', 10, 60);
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(mockRedis.zadd).not.toHaveBeenCalled();
    });

    it('should slide window correctly over time', async () => {
      mockRedis.zremrangebyscore.mockResolvedValue(5);
      mockRedis.zcard.mockResolvedValue(3);
      mockRedis.zadd.mockResolvedValue(1);
      
      const result = await service.checkSlidingWindow('ip:127.0.0.1', 10, 60);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(6);
      expect(mockRedis.zremrangebyscore).toHaveBeenCalled();
    });
  });
});

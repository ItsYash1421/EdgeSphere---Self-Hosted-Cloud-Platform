import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { UserEntity } from '../users/user.entity';
import { ApiKeyEntity } from './api-key.entity';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

jest.mock('@edgesphere/shared', () => ({
  UserRole: { USER: 'user', ADMIN: 'admin' },
  TokenPair: {},
  JwtPayload: {},
}));
jest.mock('@edgesphere/logger', () => ({ createLogger: () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }) }));
jest.mock('bcrypt');


const mockUser = (overrides = {}): UserEntity => ({
  id: 'user-uuid-1',
  email: 'test@example.com',
  passwordHash: '$2b$12$hash',
  role: 'user' as any,
  isActive: true,
  displayName: 'Test User',
  avatar: null,
  provider: 'local',
  providerId: null,
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLoginAt: null,
  lastLoginIp: null,
  ...overrides,
} as unknown as UserEntity);

const mockUsersRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
};
const mockApiKeysRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  remove: jest.fn(),
  update: jest.fn(),
};
const mockJwtService = {
  signAsync: jest.fn().mockResolvedValue('mock.jwt.token'),
};
const mockConfig = {
  get: jest.fn((key: string, def?: any) => def ?? null),
};
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  zadd: jest.fn(),
  zcard: jest.fn(),
  zrange: jest.fn(),
  zrem: jest.fn(),
  scanStream: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(UserEntity), useValue: mockUsersRepo },
        { provide: getRepositoryToken(ApiKeyEntity), useValue: mockApiKeysRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfig },
        { provide: getRedisConnectionToken(), useValue: mockRedis },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);

    mockRedis.zadd.mockResolvedValue(1);
    mockRedis.zcard.mockResolvedValue(1);
    mockRedis.zrange.mockResolvedValue([]);
    mockRedis.set.mockResolvedValue('OK');
  });

  describe('register', () => {
    it('throws ConflictException when email is already taken', async () => {
      mockUsersRepo.findOne.mockResolvedValue(mockUser());
      await expect(service.register({ email: 'test@example.com', password: 'pass' }))
        .rejects.toThrow(ConflictException);
    });

    it('hashes password with bcrypt before saving', async () => {
      mockUsersRepo.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$12$hashed');
      mockUsersRepo.create.mockReturnValue(mockUser());
      mockUsersRepo.save.mockResolvedValue(mockUser());

      await service.register({ email: 'new@example.com', password: 'secret123' });

      expect(bcrypt.hash).toHaveBeenCalledWith('secret123', 12);
    });

    it('returns a token pair on successful registration', async () => {
      mockUsersRepo.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$12$hashed');
      mockUsersRepo.create.mockReturnValue(mockUser());
      mockUsersRepo.save.mockResolvedValue(mockUser());

      const result = await service.register({ email: 'new@example.com', password: 'secret' });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException for non-existent user', async () => {
      mockUsersRepo.findOne.mockResolvedValue(null);
      await expect(service.login({ email: 'ghost@example.com', password: 'x' }, '1.2.3.4', ''))
        .rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      mockUsersRepo.findOne.mockResolvedValue(mockUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.login({ email: 'test@example.com', password: 'wrong' }, '1.2.3.4', ''))
        .rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when account is disabled', async () => {
      mockUsersRepo.findOne.mockResolvedValue(mockUser({ isActive: false }));
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      await expect(service.login({ email: 'test@example.com', password: 'pass' }, '1.2.3.4', ''))
        .rejects.toThrow(UnauthorizedException);
    });

    it('issues tokens for valid active user', async () => {
      mockUsersRepo.findOne.mockResolvedValue(mockUser());
      mockUsersRepo.update.mockResolvedValue({});
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({ email: 'test@example.com', password: 'pass' }, '1.2.3.4', 'UA');

      expect(result.accessToken).toBe('mock.jwt.token');
    });

    it('does not include passwordHash in any returned data', async () => {
      mockUsersRepo.findOne.mockResolvedValue(mockUser());
      mockUsersRepo.update.mockResolvedValue({});
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({ email: 'test@example.com', password: 'pass' }, '1.2.3.4', 'UA');

      expect(JSON.stringify(result)).not.toContain('passwordHash');
    });
  });

  describe('refreshTokens', () => {
    it('throws when refresh token format is invalid (not 3 parts)', async () => {
      const bad = Buffer.from('only:two').toString('base64');
      await expect(service.refreshTokens(bad, '1.2.3.4', 'UA')).rejects.toThrow(UnauthorizedException);
    });

    it('throws when stored token does not match (replay attack)', async () => {
      const token = Buffer.from('user-uuid-1:device-1:random-uuid').toString('base64');
      mockRedis.get.mockResolvedValue('different-token');
      await expect(service.refreshTokens(token, '1.2.3.4', 'UA')).rejects.toThrow(UnauthorizedException);
    });

    it('throws when user is inactive after token lookup', async () => {
      const token = Buffer.from('user-uuid-1:device-1:random-uuid').toString('base64');
      mockRedis.get.mockResolvedValue(token);
      mockRedis.del.mockResolvedValue(1);
      mockUsersRepo.findOne.mockResolvedValue(mockUser({ isActive: false }));

      await expect(service.refreshTokens(token, '1.2.3.4', 'UA')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateApiKey', () => {
    it('throws for key not starting with "esk_"', async () => {
      await expect(service.validateApiKey('invalid-key-format')).rejects.toThrow(UnauthorizedException);
    });

    it('throws for empty key', async () => {
      await expect(service.validateApiKey('')).rejects.toThrow(UnauthorizedException);
    });

    it('throws when SHA256 lookup returns nothing from Redis (revoked key)', async () => {
      mockRedis.get.mockResolvedValue(null);
      await expect(service.validateApiKey('esk_somevalidkey')).rejects.toThrow(UnauthorizedException);
    });

    it('throws when user is deleted but key lookup still exists in Redis', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ userId: 'user-uuid-1', keyId: 'key-1' }));
      mockUsersRepo.findOne.mockResolvedValue(null);

      await expect(service.validateApiKey('esk_somevalidkey')).rejects.toThrow(UnauthorizedException);
    });

    it('returns user payload when key is valid', async () => {
      const rawKey = 'esk_abcdef1234567890';
      const sha256 = crypto.createHash('sha256').update(rawKey).digest('hex');
      mockRedis.get.mockResolvedValue(JSON.stringify({ userId: 'user-uuid-1', keyId: 'key-1' }));
      mockUsersRepo.findOne.mockResolvedValue(mockUser());
      mockApiKeysRepo.update.mockResolvedValue({});

      const result = await service.validateApiKey(rawKey);

      expect(result.sub).toBe('user-uuid-1');
      expect(result.email).toBe('test@example.com');
    });
  });

  describe('getProfile', () => {
    it('throws NotFoundException for unknown userId', async () => {
      mockUsersRepo.findOne.mockResolvedValue(null);
      await expect(service.getProfile('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('strips passwordHash from returned profile', async () => {
      mockUsersRepo.findOne.mockResolvedValue(mockUser());

      const result = await service.getProfile('user-uuid-1');

      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('session limiting', () => {
    it('evicts oldest session when MAX_SESSIONS (5) is exceeded', async () => {
      mockUsersRepo.findOne.mockResolvedValue(mockUser());
      mockUsersRepo.update.mockResolvedValue({});
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockRedis.zcard.mockResolvedValue(6);
      mockRedis.zrange.mockResolvedValue(['oldest-device-id']);

      await service.login({ email: 'test@example.com', password: 'pass' }, '127.0.0.1', 'new-agent');

      expect(mockRedis.del).toHaveBeenCalled();
    });
  });
});

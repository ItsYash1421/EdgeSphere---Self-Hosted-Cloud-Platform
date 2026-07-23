import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../apps/auth-service/src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserEntity } from '../../apps/auth-service/src/users/user.entity';
import { getRedisToken } from '@nestjs-modules/ioredis';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  
  const mockUserRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
  
  const mockRedis = {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn(),
    del: jest.fn().mockResolvedValue(1),
    zadd: jest.fn().mockResolvedValue(1),
    zcard: jest.fn().mockResolvedValue(1),
    zrange: jest.fn().mockResolvedValue([]),
    zrem: jest.fn().mockResolvedValue(1),
  };
  
  const mockJwtService = {
    signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
  };
  
  const mockConfig = {
    get: jest.fn((key: string, defaultVal?: string) => {
      const config: Record<string, string> = {
        JWT_SECRET: 'test-secret',
        JWT_EXPIRES_IN: '15m',
      };
      return config[key] ?? defaultVal;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: getRepositoryToken(UserEntity), useValue: mockUserRepo },
        { provide: getRedisToken('default'), useValue: mockRedis },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('should create a new user and return tokens', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      const mockUser = { id: 'uuid-1', email: 'test@example.com', role: 'user', isActive: true };
      mockUserRepo.create.mockReturnValue(mockUser);
      mockUserRepo.save.mockResolvedValue(mockUser);
      
      const result = await service.register({ email: 'test@example.com', password: 'Test1234!' });
      
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
      expect(mockUserRepo.findOne).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
      expect(mockUserRepo.save).toHaveBeenCalled();
    });
    
    it('should throw ConflictException if email already exists', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'existing-user' });
      await expect(service.register({ email: 'existing@example.com', password: 'Test1234!' }))
        .rejects.toThrow('Email already registered');
    });
  });
  
  describe('login', () => {
    it('should return tokens on valid credentials', async () => {
      const hash = await bcrypt.hash('Test1234!', 12);
      mockUserRepo.findOne.mockResolvedValue({
        id: 'uuid-1', email: 'test@example.com', passwordHash: hash,
        role: 'user', isActive: true,
      });
      mockUserRepo.update.mockResolvedValue({});
      
      const result = await service.login({ email: 'test@example.com', password: 'Test1234!' }, '127.0.0.1', 'TestAgent');
      
      expect(result.accessToken).toBe('mock-jwt-token');
    });
    
    it('should throw UnauthorizedException on wrong password', async () => {
      const hash = await bcrypt.hash('correct-password', 12);
      mockUserRepo.findOne.mockResolvedValue({
        id: 'uuid-1', email: 'test@example.com', passwordHash: hash,
        role: 'user', isActive: true,
      });
      
      await expect(service.login({ email: 'test@example.com', password: 'wrong-password' }, '127.0.0.1', 'TestAgent'))
        .rejects.toThrow('Invalid credentials');
    });
    
    it('should throw UnauthorizedException if account is disabled', async () => {
      const hash = await bcrypt.hash('Test1234!', 12);
      mockUserRepo.findOne.mockResolvedValue({
        id: 'uuid-1', email: 'test@example.com', passwordHash: hash,
        role: 'user', isActive: false,
      });
      
      await expect(service.login({ email: 'test@example.com', password: 'Test1234!' }, '127.0.0.1', 'TestAgent'))
        .rejects.toThrow('Account disabled');
    });
  });
  
  describe('createApiKey', () => {
    it('should create an API key and return raw key once', async () => {
      const result = await service.createApiKey('uuid-1', 'My Key');
      
      expect(result.key).toMatch(/^esk_/);
      expect(result.keyPrefix).toHaveLength(12);
      expect(result.name).toBe('My Key');
      expect(mockRedis.set).toHaveBeenCalled();
    });
  });
});

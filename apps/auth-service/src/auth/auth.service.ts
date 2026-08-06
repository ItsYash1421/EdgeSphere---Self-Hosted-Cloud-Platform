import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { UserEntity } from '../users/user.entity';
import { ApiKeyEntity } from './api-key.entity';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { TokenPair, JwtPayload } from '@edgesphere/shared';
import { createLogger } from '@edgesphere/logger';

const logger = createLogger('auth-service');

@Injectable()
export class AuthService {
  private readonly REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
  private readonly BCRYPT_ROUNDS = 12;
  private readonly MAX_SESSIONS = 5;

  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    @InjectRepository(ApiKeyEntity)
    private readonly apiKeysRepo: Repository<ApiKeyEntity>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async register(dto: RegisterDto): Promise<TokenPair> {
    const existing = await this.usersRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);
    const user = this.usersRepo.create({ email: dto.email, passwordHash });
    await this.usersRepo.save(user);

    logger.info({ userId: user.id, email: user.email }, 'User registered');
    return this.generateTokenPair(user, '127.0.0.1', '');
  }

  async login(dto: LoginDto, ip: string, userAgent: string): Promise<TokenPair> {
    const user = await this.usersRepo.findOne({ where: { email: dto.email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account disabled');
    }

    await this.usersRepo.update(user.id, { lastLoginAt: new Date(), lastLoginIp: ip });
    logger.info({ userId: user.id }, 'User logged in');
    return this.generateTokenPair(user, ip, userAgent);
  }

  async loginOAuth(user: UserEntity, ip: string, userAgent: string): Promise<TokenPair> {
    if (!user.isActive) {
      throw new UnauthorizedException('Account disabled');
    }
    await this.usersRepo.update(user.id, { lastLoginAt: new Date(), lastLoginIp: ip });
    logger.info({ userId: user.id }, 'User logged in via OAuth');
    return this.generateTokenPair(user, ip, userAgent);
  }

  async refreshTokens(refreshToken: string, ip: string, userAgent: string): Promise<TokenPair> {
    try {
      const parts = Buffer.from(refreshToken, 'base64').toString('utf-8').split(':');
      if (parts.length !== 3) {
        throw new UnauthorizedException('Invalid refresh token format');
      }
      const [userId, deviceId] = parts;

      const storedToken = await this.redis.get(`refresh:${userId}:${deviceId}`);
      if (storedToken !== refreshToken) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      await this.redis.del(`refresh:${userId}:${deviceId}`);

      const user = await this.usersRepo.findOne({ where: { id: userId } });
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or disabled');
      }

      return this.generateTokenPair(user, ip, userAgent, deviceId);
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    try {
      const parts = Buffer.from(refreshToken, 'base64').toString('utf-8').split(':');
      if (parts.length === 3) {
        const [, deviceId] = parts;
        await this.redis.del(`refresh:${userId}:${deviceId}`);
        await this.redis.zrem(`user_sessions:${userId}`, deviceId);
      }
    } catch(e) {}
    logger.info({ userId }, 'User logged out');
  }

  async getProfile(userId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const { passwordHash: _, ...profile } = user;
    return profile;
  }

  async updateProfile(userId: string, updates: { displayName?: string }) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (updates.displayName !== undefined) {
      user.displayName = updates.displayName;
    }
    await this.usersRepo.save(user);

    const { passwordHash: _, ...profile } = user;
    logger.info({ userId }, 'Profile updated');
    return profile;
  }

  async createApiKey(userId: string, name: string) {
    const rawKey = `esk_${uuidv4().replace(/-/g, '')}`;
    const keyHash = await bcrypt.hash(rawKey, 10);
    const keyPrefix = rawKey.substring(0, 12);

    const record = this.apiKeysRepo.create({ userId, name, keyHash, keyPrefix, lastUsedAt: null, expiresAt: null });
    const saved = await this.apiKeysRepo.save(record);

    await this.redis.set(`apikey:${keyHash}`, userId, 'EX', 60 * 60 * 24 * 365);

    logger.info({ userId, name }, 'API key created');
    return {
      id: saved.id,
      key: rawKey,
      keyPrefix,
      name,
      createdAt: saved.createdAt,
      lastUsedAt: null,
      expiresAt: null,
      message: 'Store this key securely — it will not be shown again',
    };
  }

  async listApiKeys(userId: string, page = 1, pageSize = 20) {
    const [keys, total] = await this.apiKeysRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const data = keys.map(({ keyHash, ...key }) => key);
    return { data, total, page, pageSize };
  }

  async revokeApiKey(userId: string, keyId: string): Promise<void> {
    const key = await this.apiKeysRepo.findOne({ where: { id: keyId, userId } });
    if (!key) throw new NotFoundException('API key not found');

    await this.redis.del(`apikey:${key.keyHash}`);
    await this.apiKeysRepo.remove(key);
    logger.info({ userId, keyId }, 'API key revoked');
  }

  private async generateTokenPair(user: UserEntity, ip: string, userAgent: string, existingDeviceId?: string): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    
    const deviceId = existingDeviceId || crypto.createHash('sha256').update(userAgent || 'unknown').digest('hex');
    const rawRefresh = `${user.id}:${deviceId}:${uuidv4()}`;
    const refreshToken = Buffer.from(rawRefresh).toString('base64');

    const sessionKey = `user_sessions:${user.id}`;
    await this.redis.zadd(sessionKey, Date.now(), deviceId);
    
    const sessionCount = await this.redis.zcard(sessionKey);
    if (sessionCount > this.MAX_SESSIONS) {
      const oldest = await this.redis.zrange(sessionKey, 0, 0);
      if (oldest.length > 0) {
        await this.redis.del(`refresh:${user.id}:${oldest[0]}`);
        await this.redis.zrem(sessionKey, oldest[0]);
      }
    }

    await this.redis.set(
      `refresh:${user.id}:${deviceId}`,
      refreshToken,
      'EX',
      this.REFRESH_TOKEN_TTL,
    );

    const expiresIn = this.parseExpiry(this.config.get('JWT_EXPIRES_IN', '15m'));
    return { accessToken, refreshToken, expiresIn };
  }

  private parseExpiry(str: string): number {
    const match = str.match(/^(\d+)([mhd])$/);
    if (!match) return 900;
    const value = parseInt(match[1]);
    const unit = match[2];
    if (unit === 'm') return value * 60;
    if (unit === 'h') return value * 3600;
    if (unit === 'd') return value * 86400;
    return 900;
  }
}

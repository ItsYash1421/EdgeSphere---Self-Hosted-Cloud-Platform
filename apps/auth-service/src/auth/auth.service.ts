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
import { v4 as uuidv4 } from 'uuid';
import { UserEntity } from '../users/user.entity';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { TokenPair, JwtPayload } from '@edgesphere/shared';
import { createLogger } from '@edgesphere/logger';

const logger = createLogger('auth-service');

@Injectable()
export class AuthService {
  private readonly REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
  private readonly BCRYPT_ROUNDS = 12;

  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /**
   * Register a new user.
   * Returns token pair on success.
   */
  async register(dto: RegisterDto): Promise<TokenPair> {
    const existing = await this.usersRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);
    const user = this.usersRepo.create({ email: dto.email, passwordHash });
    await this.usersRepo.save(user);

    logger.info({ userId: user.id, email: user.email }, 'User registered');
    return this.generateTokenPair(user);
  }

  /**
   * Login with email + password.
   * Returns token pair on success.
   */
  async login(dto: LoginDto): Promise<TokenPair> {
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

    await this.usersRepo.update(user.id, { lastLoginAt: new Date() });
    logger.info({ userId: user.id }, 'User logged in');
    return this.generateTokenPair(user);
  }

  /**
   * Rotate refresh token.
   * Old token is blacklisted; new pair returned.
   */
  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const userId = await this.redis.get(`refresh:${refreshToken}`);
    if (!userId) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // One-time use: delete old token
    await this.redis.del(`refresh:${refreshToken}`);

    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or disabled');
    }

    return this.generateTokenPair(user);
  }

  /**
   * Invalidate a refresh token (logout).
   */
  async logout(refreshToken: string): Promise<void> {
    await this.redis.del(`refresh:${refreshToken}`);
    logger.info('User logged out');
  }

  /**
   * Get user profile by ID.
   */
  async getProfile(userId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const { passwordHash: _, ...profile } = user;
    return profile;
  }

  /**
   * Create an API key for the user.
   * Returns the raw key ONCE — only the hash is stored.
   */
  async createApiKey(userId: string, name: string) {
    const rawKey = `esk_${uuidv4().replace(/-/g, '')}`;  // EdgeSphere Key
    const keyHash = await bcrypt.hash(rawKey, 10);
    const keyPrefix = rawKey.substring(0, 12);

    await this.redis.set(`apikey:${keyHash}`, userId, 'EX', 60 * 60 * 24 * 365); // 1 year

    logger.info({ userId, name }, 'API key created');
    return {
      key: rawKey,  // ONLY time the full key is returned
      keyPrefix,
      name,
      createdAt: new Date(),
      message: 'Store this key securely — it will not be shown again',
    };
  }

  /**
   * List API keys (without the actual key value).
   */
  async listApiKeys(userId: string) {
    // In production, this would query an api_keys table
    // Simplified for Phase 1
    return { keys: [], message: 'API key listing requires database table — TODO Phase 1' };
  }

  /**
   * Revoke an API key.
   */
  async revokeApiKey(userId: string, keyId: string): Promise<void> {
    // In production, mark as revoked in DB and delete from Redis
    logger.info({ userId, keyId }, 'API key revoked');
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  private async generateTokenPair(user: UserEntity): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = uuidv4();

    // Store refresh token in Redis with TTL
    await this.redis.set(
      `refresh:${refreshToken}`,
      user.id,
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

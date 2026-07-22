import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async findById(id: string): Promise<UserEntity | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findOrCreateByOAuth(
    email: string,
    displayName: string,
    avatar: string,
    provider: string,
    providerId: string,
  ): Promise<UserEntity> {
    let user = await this.findByEmail(email);
    if (!user) {
      user = this.userRepository.create({
        email,
        displayName,
        avatar,
        provider,
        providerId,
        emailVerified: true,
      });
      await this.userRepository.save(user);
    } else if (!user.providerId) {
      // Link existing account with OAuth
      user.provider = provider;
      user.providerId = providerId;
      user.displayName = user.displayName || displayName;
      user.avatar = user.avatar || avatar;
      user.emailVerified = true;
      await this.userRepository.save(user);
    }
    return user;
  }

  async updateLastLogin(userId: string, ip: string): Promise<void> {
    await this.userRepository.update(userId, {
      lastLoginAt: new Date(),
      lastLoginIp: ip,
    });
  }
}

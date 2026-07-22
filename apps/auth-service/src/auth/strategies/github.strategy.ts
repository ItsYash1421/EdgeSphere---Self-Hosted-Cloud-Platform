import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { UsersService } from '../../users/users.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private readonly usersService: UsersService) {
    super({
      clientID: process.env.GITHUB_CLIENT_ID || 'mock-client-id',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || 'mock-client-secret',
      callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3001/auth/oauth/github/callback',
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: any,
  ): Promise<any> {
    const { id, displayName, username, emails, photos } = profile;
    const email = emails && emails.length > 0 ? emails[0].value : `${username}@github.com`;
    const avatar = photos && photos.length > 0 ? photos[0].value : null;

    const user = await this.usersService.findOrCreateByOAuth(
      email,
      displayName || username,
      avatar,
      'github',
      id,
    );
    done(null, user);
  }
}

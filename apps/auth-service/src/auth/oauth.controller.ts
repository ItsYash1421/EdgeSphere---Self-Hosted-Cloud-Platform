import { Controller, Get, Req, Res, UseGuards, Headers } from '@nestjs/common';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GithubAuthGuard } from './guards/github-auth.guard';
import { AuthService } from './auth.service';
import { Request, Response } from 'express';

@Controller('auth/oauth')
export class OAuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth(@Req() req: Request) {
    // Redirects to Google
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(@Req() req: Request, @Res() res: Response, @Headers('user-agent') userAgent: string = '') {
    const user = req.user as any;
    const ip = req.ip || '127.0.0.1';
    const tokens = await this.authService.loginOAuth(user, ip, userAgent);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3100';
    res.redirect(`${frontendUrl}/auth/callback?token=${tokens.accessToken}&refresh=${tokens.refreshToken}`);
  }

  @Get('github')
  @UseGuards(GithubAuthGuard)
  async githubAuth(@Req() req: Request) {
    // Redirects to Github
  }

  @Get('github/callback')
  @UseGuards(GithubAuthGuard)
  async githubAuthCallback(@Req() req: Request, @Res() res: Response, @Headers('user-agent') userAgent: string = '') {
    const user = req.user as any;
    const ip = req.ip || '127.0.0.1';
    const tokens = await this.authService.loginOAuth(user, ip, userAgent);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3100';
    res.redirect(`${frontendUrl}/auth/callback?token=${tokens.accessToken}&refresh=${tokens.refreshToken}`);
  }

  @Get('providers')
  getProviders() {
    return {
      providers: ['google', 'github'],
      googleEnabled: !!process.env.GOOGLE_CLIENT_ID,
      githubEnabled: !!process.env.GITHUB_CLIENT_ID,
    };
  }
}

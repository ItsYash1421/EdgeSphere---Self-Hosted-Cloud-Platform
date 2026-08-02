import { Controller, Get, Patch, Body, ForbiddenException, BadRequestException, Req } from '@nestjs/common';
import { Request } from 'express';
import { PlatformConfigService, PlatformConfig } from './platform-config.service';

@Controller('config')
export class PlatformConfigController {
  constructor(private readonly platformConfigService: PlatformConfigService) {}

  @Get()
  async getConfig(): Promise<PlatformConfig> {
    return this.platformConfigService.getConfig();
  }

  @Patch()
  async updateConfig(
    @Req() req: Request & { user?: { role?: string } },
    @Body() updates: Partial<PlatformConfig>,
  ): Promise<PlatformConfig> {
    if (req.user?.role !== 'admin') {
      throw new ForbiddenException('Only admins can update platform configuration');
    }

    if (updates.cacheTtlSeconds !== undefined && (updates.cacheTtlSeconds < 1 || updates.cacheTtlSeconds > 86400)) {
      throw new BadRequestException('cacheTtlSeconds must be between 1 and 86400');
    }
    if (updates.maxFileSizeMb !== undefined && (updates.maxFileSizeMb < 1 || updates.maxFileSizeMb > 10240)) {
      throw new BadRequestException('maxFileSizeMb must be between 1 and 10240');
    }
    if (updates.rateLimitPerIp !== undefined && (updates.rateLimitPerIp < 1 || updates.rateLimitPerIp > 100000)) {
      throw new BadRequestException('rateLimitPerIp must be between 1 and 100000');
    }

    return this.platformConfigService.updateConfig(updates);
  }
}

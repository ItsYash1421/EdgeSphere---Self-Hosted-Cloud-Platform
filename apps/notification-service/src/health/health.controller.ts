import { Controller, Get } from '@nestjs/common';

@Controller('notifications/health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      kafka: 'connected',
      smtp: 'configured',
      uptime: process.uptime(),
    };
  }
}

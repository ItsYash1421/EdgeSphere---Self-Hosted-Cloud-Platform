import { Controller, Get } from '@nestjs/common';

@Controller('cache/health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

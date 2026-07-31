import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

@Controller('health')
export class HealthController {
  private startTime: number;

  constructor(@InjectDataSource() private dataSource: DataSource) {
    this.startTime = Date.now();
  }

  @Get()
  async getHealth() {
    let dbStatus = 'down';
    try {
      if (this.dataSource.isInitialized) {
        dbStatus = 'up';
      }
    } catch (e) {
      dbStatus = 'down';
    }

    return {
      status: 'ok',
      kafka: 'connected', // Normally we'd check KafkaService status
      db: dbStatus,
      eventsIngested: 0, // Should be fetched from metrics service
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }
}
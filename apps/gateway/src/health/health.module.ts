import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ResilienceModule } from '../resilience/resilience.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ResilienceModule, ConfigModule],
  controllers: [HealthController],
})
export class HealthModule {}

import { Module, OnModuleInit } from '@nestjs/common';
import { InvalidationController } from './invalidation.controller';
import { InvalidationService } from './invalidation.service';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [MetricsModule],
  controllers: [InvalidationController],
  providers: [InvalidationService],
})
export class InvalidationModule implements OnModuleInit {
  constructor(private readonly invalidationService: InvalidationService) {}

  async onModuleInit() {
    await this.invalidationService.subscribeToStorageEvents();
  }
}

import { Module, Global } from '@nestjs/common';
import { EventPublisherService } from './event-publisher.service';
import { DlqService } from './dlq.service';
import { MetricsModule } from '../metrics/metrics.module';

@Global()
@Module({
  imports: [MetricsModule],
  providers: [EventPublisherService, DlqService],
  exports: [EventPublisherService, DlqService],
})
export class EventsModule {}

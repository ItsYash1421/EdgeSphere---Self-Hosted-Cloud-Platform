import { Module } from '@nestjs/common';
import { KafkaConsumerService } from './kafka-consumer.service';
import { KafkaProducerService } from './kafka-producer.service';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [AnalyticsModule],
  providers: [KafkaConsumerService, KafkaProducerService],
  exports: [KafkaProducerService],
})
export class KafkaModule {}\n
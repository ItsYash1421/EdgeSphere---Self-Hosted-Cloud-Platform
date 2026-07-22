import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';
import { EventsGateway } from './events/events.gateway';
import { KafkaConsumerService } from './kafka/kafka-consumer.service';
import { MetricsService } from './metrics/metrics.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule.forRootAsync({
      useFactory: () => ({
        type: 'single',
        url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
        options: { password: process.env.REDIS_PASSWORD || undefined },
      }),
    }),
  ],
  providers: [EventsGateway, KafkaConsumerService, MetricsService],
})
export class AppModule {}

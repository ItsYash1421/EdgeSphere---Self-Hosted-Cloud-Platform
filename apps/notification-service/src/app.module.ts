import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AlertsModule } from './alerts/alerts.module';
import { NotificationsModule } from './notifications/notifications.module';
import { KafkaConsumerModule } from './kafka/kafka-consumer.module';
import { MetricsModule } from './metrics/metrics.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AlertsModule,
    NotificationsModule,
    KafkaConsumerModule,
    MetricsModule,
    HealthModule,
  ],
})
export class AppModule {}

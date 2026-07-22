import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaModule } from './kafka/kafka.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { MetricsModule } from './metrics/metrics.module';
import { HealthModule } from './health/health.module';
import { RequestEventEntity } from './analytics/request-event.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USER', 'edgesphere'),
        password: configService.get<string>('DB_PASSWORD', 'edgesphere_secret'),
        database: configService.get<string>('DB_NAME', 'edgesphere'),
        entities: [RequestEventEntity],
        synchronize: false, // Use init.sql for migrations
      }),
      inject: [ConfigService],
    }),
    KafkaModule,
    AnalyticsModule,
    MetricsModule,
    HealthModule,
  ],
})
export class AppModule {}\n
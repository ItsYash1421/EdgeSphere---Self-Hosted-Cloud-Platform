import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [NotificationsModule, MetricsModule],
  providers: [AlertsService],
  controllers: [AlertsController],
  exports: [AlertsService],
})
export class AlertsModule {}

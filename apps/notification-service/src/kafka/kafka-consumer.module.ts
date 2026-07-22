import { Module, forwardRef } from '@nestjs/common';
import { KafkaConsumerService } from './kafka-consumer.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [forwardRef(() => NotificationsModule)],
  providers: [KafkaConsumerService],
  exports: [KafkaConsumerService],
})
export class KafkaConsumerModule {}

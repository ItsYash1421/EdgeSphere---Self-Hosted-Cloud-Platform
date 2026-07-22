import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer } from 'kafkajs';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private consumer: Consumer;
  private kafka: Kafka;

  constructor(
    private configService: ConfigService,
    private notificationsService: NotificationsService,
  ) {
    const broker = this.configService.get<string>('KAFKA_BROKER') || 'localhost:9092';
    const clientId = this.configService.get<string>('KAFKA_CLIENT_ID') || 'notification-service';
    const groupId = this.configService.get<string>('KAFKA_GROUP_ID') || 'notification-group';

    this.kafka = new Kafka({
      clientId,
      brokers: [broker],
    });

    this.consumer = this.kafka.consumer({ groupId });
  }

  async onModuleInit() {
    try {
      await this.consumer.connect();
      await this.consumer.subscribe({ topic: 'alerts.triggered', fromBeginning: false });
      await this.consumer.subscribe({ topic: 'system.events', fromBeginning: false });

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          if (!message.value) return;
          const event = JSON.parse(message.value.toString());
          console.log(`Received message on topic ${topic}:`, event);
          
          if (topic === 'alerts.triggered' || topic === 'system.events') {
            await this.notificationsService.dispatch(event, event.channels || ['email', 'webhook']);
          }
        },
      });
      console.log('Kafka Consumer connected and subscribed');
    } catch (error) {
      console.error('Failed to connect to Kafka', error);
    }
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }
}

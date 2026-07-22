import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import { RequestEventDto } from '../analytics/dto/analytics.dto';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private producer: Producer;
  private readonly logger = new Logger(KafkaProducerService.name);

  constructor(private readonly configService: ConfigService) {
    const broker = this.configService.get<string>('KAFKA_BROKER', 'localhost:9092');
    const clientId = this.configService.get<string>('KAFKA_CLIENT_ID', 'analytics-service');

    this.kafka = new Kafka({
      clientId,
      brokers: [broker],
    });

    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      this.logger.log('Kafka Producer connected');
    } catch (error) {
      this.logger.error('Failed to connect Kafka Producer', error);
    }
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
    this.logger.log('Kafka Producer disconnected');
  }

  async publishRequestEvent(event: RequestEventDto): Promise<void> {
    try {
      await this.producer.send({
        topic: 'request.events',
        messages: [{ value: JSON.stringify(event) }],
      });
    } catch (error) {
      this.logger.error('Failed to publish request event', error);
      throw error;
    }
  }

  async publishStorageEvent(event: any): Promise<void> {
    try {
      await this.producer.send({
        topic: 'storage.events',
        messages: [{ value: JSON.stringify(event) }],
      });
    } catch (error) {
      this.logger.error('Failed to publish storage event', error);
      throw error;
    }
  }
}\n
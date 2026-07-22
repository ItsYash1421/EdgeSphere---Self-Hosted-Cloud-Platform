import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer } from 'kafkajs';
import { AnalyticsService } from '../analytics/analytics.service';
import { RequestEventDto } from '../analytics/dto/analytics.dto';

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private consumer: Consumer;
  private readonly logger = new Logger(KafkaConsumerService.name);
  private batch: RequestEventDto[] = [];
  private batchTimer: NodeJS.Timeout;
  private isProcessing = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly analyticsService: AnalyticsService,
  ) {
    const broker = this.configService.get<string>('KAFKA_BROKER', 'localhost:9092');
    const clientId = this.configService.get<string>('KAFKA_CLIENT_ID', 'analytics-service');
    const groupId = this.configService.get<string>('KAFKA_GROUP_ID', 'analytics-group');

    this.kafka = new Kafka({
      clientId,
      brokers: [broker],
    });

    this.consumer = this.kafka.consumer({ groupId });
  }

  async onModuleInit() {
    try {
      await this.consumer.connect();
      this.logger.log('Kafka Consumer connected');

      await this.consumer.subscribe({ topic: 'request.events', fromBeginning: false });
      await this.consumer.subscribe({ topic: 'storage.events', fromBeginning: false });

      this.logger.log('Subscribed to topics: request.events, storage.events');

      this.batchTimer = setInterval(() => this.flushBatch(), 500);

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          if (!message.value) return;

          try {
            const eventStr = message.value.toString();
            const event = JSON.parse(eventStr);
            
            if (topic === 'request.events') {
              this.batch.push(event as RequestEventDto);
              if (this.batch.length >= 1000) {
                await this.flushBatch();
              }
            } else if (topic === 'storage.events') {
              // Ignore for now or handle appropriately
            }
          } catch (error) {
            this.logger.error(`Failed to process message from topic ${topic}`, error);
          }
        },
      });
    } catch (error) {
      this.logger.error('Failed to initialize Kafka consumer', error);
    }
  }

  private async flushBatch() {
    if (this.batch.length === 0 || this.isProcessing) return;
    
    this.isProcessing = true;
    const currentBatch = [...this.batch];
    this.batch = [];

    try {
      await this.analyticsService.ingestEventBatch(currentBatch);
    } catch (error) {
      this.logger.error('Failed to ingest batch', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async onModuleDestroy() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }
    await this.flushBatch();
    await this.consumer.disconnect();
    this.logger.log('Kafka Consumer disconnected');
  }

  getConsumer(): Consumer {
    return this.consumer;
  }
}\n
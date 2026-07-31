import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { ConfigService } from '@nestjs/config';
import { DlqService } from './dlq.service';

@Injectable()
export class EventPublisherService implements OnModuleInit, OnModuleDestroy {
  private producer: Producer;
  private kafka: Kafka;

  constructor(
    private configService: ConfigService,
    private dlqService: DlqService
  ) {
    const broker = this.configService.get<string>('KAFKA_BROKER') || 'localhost:9092';
    
    this.kafka = new Kafka({
      clientId: 'gateway',
      brokers: [broker],
    });

    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    // Connect in background — don't crash gateway if Kafka is unavailable
    this.producer.connect()
      .then(() => console.log('Gateway Kafka Producer connected'))
      .catch((err) => console.warn('Kafka unavailable, events will be skipped:', err.message));
  }

  async onModuleDestroy() {
    try { await this.producer.disconnect(); } catch (_) {}
  }

  async publishRequestEvent(data: {
    time: Date;
    service: string;
    method: string;
    path: string;
    status: number;
    latencyMs: number;
    userId?: string;
    ip: string;
    cacheHit: boolean;
    bytes: number;
    edgeRegion?: string;
  }): Promise<void> {
    const topic = 'request.events';
    try {
      await this.producer.send({
        topic,
        messages: [{ value: JSON.stringify(data) }],
      });
    } catch (error: any) {
      console.error('Failed to publish request event', error);
      await this.dlqService.publishToDlq(topic, data, error.message || 'Unknown error', 0);
    }
  }
}

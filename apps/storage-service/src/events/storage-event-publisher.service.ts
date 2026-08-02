import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka } from 'kafkajs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageEventPublisherService implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private producer: any;

  constructor(private readonly configService: ConfigService) {
    this.kafka = new Kafka({
      clientId: 'storage-service',
      brokers: [this.configService.get<string>('KAFKA_BROKER', 'localhost:9092')]
    });
    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    // Connect in background — don't crash storage-service if Kafka is unavailable
    this.producer.connect()
      .then(() => console.log('Storage Kafka Producer connected'))
      .catch((err: Error) => console.warn('Kafka unavailable, storage events will be skipped:', err.message));
  }

  async onModuleDestroy() {
    try { await this.producer.disconnect(); } catch (_) {}
  }

  async publishStorageEvent(payload: any) {
    await this.producer.send({
      topic: 'storage.events',
      messages: [{ value: JSON.stringify(payload) }],
    });
  }

  async publishCacheInvalidation(payload: any) {
    await this.producer.send({
      topic: 'cache.invalidate',
      messages: [{ value: JSON.stringify(payload) }],
    });
  }
}

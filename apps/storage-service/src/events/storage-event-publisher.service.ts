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
    await this.producer.connect();
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
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

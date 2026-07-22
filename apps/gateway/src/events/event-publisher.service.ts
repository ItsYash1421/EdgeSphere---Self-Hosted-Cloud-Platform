import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EventPublisherService implements OnModuleInit, OnModuleDestroy {
  private producer: Producer;
  private kafka: Kafka;

  constructor(private configService: ConfigService) {
    const broker = this.configService.get<string>('KAFKA_BROKER') || 'localhost:9092';
    
    this.kafka = new Kafka({
      clientId: 'gateway',
      brokers: [broker],
    });

    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      console.log('Gateway Kafka Producer connected');
    } catch (error) {
      console.error('Failed to connect Gateway Kafka Producer', error);
    }
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
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
    this.producer.send({
      topic: 'request.events',
      messages: [{ value: JSON.stringify(data) }],
    }).catch(error => {
      console.error('Failed to publish request event', error);
    });
  }
}

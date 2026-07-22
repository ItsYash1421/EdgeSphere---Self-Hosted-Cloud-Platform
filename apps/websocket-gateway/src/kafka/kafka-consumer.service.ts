import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka } from 'kafkajs';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private kafka: Kafka;
  private consumer: any;
  private metricsInterval: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventsGateway: EventsGateway,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async onModuleInit() {
    const broker = this.configService.get<string>('KAFKA_BROKER') || 'localhost:9092';
    const clientId = this.configService.get<string>('KAFKA_CLIENT_ID') || 'websocket-gateway';
    const groupId = this.configService.get<string>('KAFKA_GROUP_ID') || 'websocket-group';

    this.kafka = new Kafka({ clientId, brokers: [broker] });
    this.consumer = this.kafka.consumer({ groupId });

    try {
      await this.consumer.connect();
      await this.consumer.subscribe({ topics: ['request.events', 'storage.events', 'alerts.triggered'], fromBeginning: false });

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          if (!message.value) return;
          try {
            const data = JSON.parse(message.value.toString());
            if (topic === 'request.events') this.eventsGateway.emitRequestEvent(data);
            else if (topic === 'storage.events') this.eventsGateway.emitStorageEvent(data);
            else if (topic === 'alerts.triggered') this.eventsGateway.emitAlert(data);
          } catch (err) {
            this.logger.error(`Error processing message from ${topic}`, err);
          }
        },
      });

      // Redis subscriber for cache purge
      const redisSub = this.redis.duplicate();
      redisSub.subscribe('cache:invalidate');
      redisSub.on('message', (channel, message) => {
        if (channel === 'cache:invalidate') {
          try {
            this.eventsGateway.emitCachePurge(JSON.parse(message));
          } catch (e) {}
        }
      });

      this.startMetricsEmitter();
    } catch (err) {
      this.logger.error('Failed to connect to Kafka', err);
    }
  }

  startMetricsEmitter() {
    this.metricsInterval = setInterval(async () => {
      // Simulate real metrics computation for now
      const metrics = {
        requestsPerSec: Math.random() * 100,
        cacheHitRatio: Math.random(),
        avgLatencyMs: Math.random() * 50,
        activeConnections: this.eventsGateway.getConnectedClientsCount(),
        errorRate: Math.random() * 0.05,
        timestamp: new Date().toISOString()
      };
      this.eventsGateway.emitMetricsUpdate(metrics);
    }, 5000);
  }

  async onModuleDestroy() {
    clearInterval(this.metricsInterval);
    if (this.consumer) await this.consumer.disconnect();
  }
}

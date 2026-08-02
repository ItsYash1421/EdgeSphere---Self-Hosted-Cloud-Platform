import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka } from 'kafkajs';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { EventsGateway } from '../events/events.gateway';

interface RecentRequestSample {
  receivedAt: number;
  latencyMs: number;
  cacheHit: boolean;
  status: number;
}

const METRICS_WINDOW_MS = 5000;

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private kafka: Kafka;
  private consumer: any;
  private metricsInterval: NodeJS.Timeout;
  private recentRequests: RecentRequestSample[] = [];

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
            if (topic === 'request.events') {
              this.eventsGateway.emitRequestEvent(data);
              this.recentRequests.push({
                receivedAt: Date.now(),
                latencyMs: data.latencyMs || 0,
                cacheHit: !!data.cacheHit,
                status: data.status || 0,
              });
            }
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
    this.metricsInterval = setInterval(() => {
      const cutoff = Date.now() - METRICS_WINDOW_MS;
      this.recentRequests = this.recentRequests.filter((r) => r.receivedAt >= cutoff);

      const total = this.recentRequests.length;
      const hits = this.recentRequests.filter((r) => r.cacheHit).length;
      const errors = this.recentRequests.filter((r) => r.status >= 400).length;
      const latencySum = this.recentRequests.reduce((sum, r) => sum + r.latencyMs, 0);

      const metrics = {
        requestsPerSec: total / (METRICS_WINDOW_MS / 1000),
        cacheHitRatio: total > 0 ? hits / total : 0,
        avgLatencyMs: total > 0 ? latencySum / total : 0,
        activeConnections: this.eventsGateway.getConnectedClientsCount(),
        errorRate: total > 0 ? errors / total : 0,
        timestamp: new Date().toISOString()
      };
      this.eventsGateway.emitMetricsUpdate(metrics);
    }, METRICS_WINDOW_MS);
  }

  async onModuleDestroy() {
    clearInterval(this.metricsInterval);
    if (this.consumer) await this.consumer.disconnect();
  }
}

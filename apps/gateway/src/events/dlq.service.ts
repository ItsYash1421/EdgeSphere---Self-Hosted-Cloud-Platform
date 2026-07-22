import { Injectable, Logger } from '@nestjs/common';
import { Kafka, Producer, Consumer } from 'kafkajs';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class DlqService {
  private readonly logger = new Logger(DlqService.name);
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;

  constructor(
    private configService: ConfigService,
    private metricsService: MetricsService
  ) {
    const broker = this.configService.get<string>('KAFKA_BROKER') || 'localhost:9092';
    
    this.kafka = new Kafka({
      clientId: 'gateway-dlq',
      brokers: [broker],
    });

    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({ groupId: 'gateway-dlq-group' });
  }

  async onModuleInit() {
    await this.producer.connect();
    await this.consumer.connect();
    this.subscribeAndRetry();
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
    await this.consumer.disconnect();
  }

  async publishToDlq(originalTopic: string, message: any, error: string, attempt: number): Promise<void> {
    const dlqTopic = `${originalTopic}.dlq`;
    const retryAfter = this.getRetryAfterMs(attempt);
    
    const dlqMessage = {
      originalTopic,
      originalMessage: message,
      error,
      attempt,
      timestamp: new Date().toISOString(),
      retryAfter
    };

    try {
      await this.producer.send({
        topic: dlqTopic,
        messages: [{ value: JSON.stringify(dlqMessage) }],
      });
      this.metricsService.recordDlqMessage(originalTopic, error.substring(0, 50));
    } catch (err) {
      this.logger.error(`Failed to publish to DLQ topic ${dlqTopic}`, err);
    }
  }

  private getRetryAfterMs(attempt: number): number {
    // 1st retry after 30s, 2nd after 5min, 3rd after 30min
    if (attempt === 0) return 30 * 1000;
    if (attempt === 1) return 5 * 60 * 1000;
    if (attempt === 2) return 30 * 60 * 1000;
    return -1; // Give up
  }

  async subscribeAndRetry(): Promise<void> {
    // Subscribe to *.dlq topics (kafkajs supports regex for topics)
    await this.consumer.subscribe({ topic: /.*\.dlq$/, fromBeginning: false });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;
        
        try {
          const dlqMsg = JSON.parse(message.value.toString());
          const now = Date.now();
          const msgTime = new Date(dlqMsg.timestamp).getTime();
          
          if (dlqMsg.retryAfter === -1 || dlqMsg.attempt >= 3) {
            this.logger.error(`Message permanently failed after ${dlqMsg.attempt} attempts: ${dlqMsg.error}`);
            this.metricsService.recordDlqPermanentFailure();
            return;
          }
          
          const waitTime = (msgTime + dlqMsg.retryAfter) - now;
          if (waitTime > 0) {
            // In a real system, we might pause consumer, or use a delayed exchange.
            // For this phase, we simply await sleep
            await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 10000))); // Cap wait to not block completely, but it's simplified here
          }
          
          // Retry by sending back to original topic
          try {
            await this.producer.send({
              topic: dlqMsg.originalTopic,
              messages: [{ value: typeof dlqMsg.originalMessage === 'string' ? dlqMsg.originalMessage : JSON.stringify(dlqMsg.originalMessage) }],
            });
            this.metricsService.recordDlqRetrySuccess();
          } catch (retryError: any) {
            // If it fails again, publish to DLQ with incremented attempt
            await this.publishToDlq(dlqMsg.originalTopic, dlqMsg.originalMessage, retryError.message || 'Retry failed', dlqMsg.attempt + 1);
          }
        } catch (e) {
          this.logger.error('Failed to process DLQ message', e);
        }
      },
    });
  }
}

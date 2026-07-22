import { Module } from '@nestjs/common';
import { StorageEventPublisherService } from './storage-event-publisher.service';
import { EventsGateway } from './events.gateway';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [StorageEventPublisherService, EventsGateway],
  exports: [StorageEventPublisherService, EventsGateway],
})
export class EventsModule {}

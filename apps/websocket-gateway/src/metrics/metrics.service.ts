import { Injectable, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  public wsConnectionsTotal: client.Gauge<string>;
  public wsMessagesSentTotal: client.Counter<string>;
  public wsRooms: client.Gauge<string>;

  onModuleInit() {
    this.wsConnectionsTotal = new client.Gauge({
      name: 'ws_connections_total',
      help: 'Total number of active WebSocket connections'
    });

    this.wsMessagesSentTotal = new client.Counter({
      name: 'ws_messages_sent_total',
      help: 'Total messages sent via WebSocket',
      labelNames: ['event_type']
    });

    this.wsRooms = new client.Gauge({
      name: 'ws_rooms',
      help: 'Number of subscribers per room',
      labelNames: ['room']
    });
  }
}

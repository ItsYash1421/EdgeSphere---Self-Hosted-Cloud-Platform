import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

export interface RequestEventDto {
  id: string;
  url: string;
  status: number;
  durationMs: number;
  timestamp: string;
}

export interface RealtimeMetrics {
  requestsPerSec: number;
  cacheHitRatio: number;
  avgLatencyMs: number;
  activeConnections: number;
  errorRate: number;
  timestamp: string;
}

export interface AlertTriggeredDto {
  id: string;
  name: string;
  severity: string;
  timestamp: string;
}

export interface StorageEventDto {
  fileId: string;
  action: string;
  timestamp: string;
}

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/realtime' })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  
  handleConnection(client: Socket) {
    client.emit('connected', {
      clientId: client.id,
      timestamp: new Date().toISOString(),
      subscribedRooms: []
    });
  }
  
  handleDisconnect(client: Socket) {
    // Cleanup if necessary
  }
  
  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, rooms: string[]) {
    rooms.forEach(room => client.join(room));
    return { event: 'subscribed', data: rooms };
  }
  
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, rooms: string[]) {
    rooms.forEach(room => client.leave(room));
  }
  
  emitRequestEvent(event: RequestEventDto) {
    this.server.to('events').emit('request_event', event);
  }
  
  emitMetricsUpdate(metrics: RealtimeMetrics) {
    this.server.to('metrics').emit('metrics_update', metrics);
  }
  
  emitAlert(alert: AlertTriggeredDto) {
    this.server.to('alerts').emit('alert_triggered', alert);
  }
  
  emitCachePurge(event: { bucket: string; keysDeleted: number; timestamp: string }) {
    this.server.to('cdn').emit('cache_purged', event);
  }
  
  emitStorageEvent(event: StorageEventDto) {
    this.server.to('storage').emit('storage_event', event);
  }
  
  broadcast(event: string, data: any) {
    this.server.emit(event, data);
  }
  
  getConnectedClientsCount(): number {
    return this.server.sockets.sockets.size;
  }
}

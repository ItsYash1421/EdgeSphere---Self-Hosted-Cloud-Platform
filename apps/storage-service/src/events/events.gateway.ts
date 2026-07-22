import { WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { createLogger } from '@edgesphere/logger';

const logger = createLogger('storage-service:events-gateway');

@WebSocketGateway({ cors: true, namespace: '/storage-events' })
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  afterInit(server: Server) {
    logger.info('Storage Events WebSocket Gateway initialized');
  }

  handleConnection(client: Socket, ...args: any[]) {
    logger.info(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    logger.info(`Client disconnected: ${client.id}`);
  }

  broadcastStorageEvent(event: any) {
    this.server.emit('storage.events', event);
  }
}

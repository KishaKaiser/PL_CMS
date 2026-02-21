import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  // IMPORTANT: do not ship with origin: '*'
  // Use env to keep this deployable across environments.
  cors: { origin: process.env.CORS_ORIGIN ?? process.env.WEB_BASE_URL ?? 'http://localhost:3000' },
  namespace: '/ws',
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AppGateway.name);

  handleConnection(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /** Presence: client sets itself online/offline */
  @SubscribeMessage('presence')
  handlePresence(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; status: 'online' | 'offline' },
  ) {
    this.server.emit('presence:update', data);
    return { event: 'presence:ack', data };
  }

  /** Stub: direct message forwarding */
  @SubscribeMessage('message')
  handleMessage(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: { to: string; body: string },
  ) {
    this.server.to(data.to).emit('message', data);
    return { event: 'message:ack', data };
  }
}

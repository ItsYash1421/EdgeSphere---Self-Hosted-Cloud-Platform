import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3006', {
      namespace: '/realtime',
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });
  }
  return socket;
}

export function subscribeToRoom(room: string): void {
  getSocket().emit('subscribe', [room]);
}

export function unsubscribeFromRoom(room: string): void {
  getSocket().emit('unsubscribe', [room]);
}

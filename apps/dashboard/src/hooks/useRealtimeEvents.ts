import { useState, useEffect } from 'react';
import { getSocket, subscribeToRoom, unsubscribeFromRoom } from '../lib/websocket';

export interface RequestEventDto {
  time: string;
  service: string;
  method: string;
  path: string;
  status: number;
  latencyMs: number;
  ip: string;
  cacheHit: boolean;
  bytes: number;
  edgeRegion?: string;
}

export function useRealtimeEvents(maxEvents: number = 100) {
  const [events, setEvents] = useState<RequestEventDto[]>([]);
  
  useEffect(() => {
    const socket = getSocket();
    subscribeToRoom('events');
    
    socket.on('request_event', (event: RequestEventDto) => {
      setEvents(prev => [event, ...prev].slice(0, maxEvents));
    });
    
    return () => {
      socket.off('request_event');
      unsubscribeFromRoom('events');
    };
  }, [maxEvents]);
  
  return events;
}

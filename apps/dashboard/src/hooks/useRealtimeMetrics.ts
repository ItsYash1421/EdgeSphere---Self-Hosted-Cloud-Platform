import { useState, useEffect } from 'react';
import { getSocket, subscribeToRoom, unsubscribeFromRoom } from '../lib/websocket';

export interface RealtimeMetrics {
  requestsPerSec: number;
  cacheHitRatio: number;
  avgLatencyMs: number;
  activeConnections: number;
  errorRate: number;
  timestamp: string;
}

export function useRealtimeMetrics() {
  const [metrics, setMetrics] = useState<RealtimeMetrics | null>(null);
  const [connected, setConnected] = useState(false);
  
  useEffect(() => {
    const socket = getSocket();
    subscribeToRoom('metrics');
    
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('metrics_update', (data) => setMetrics(data));
    
    // Check initial status
    setConnected(socket.connected);
    
    return () => {
      socket.off('metrics_update');
      socket.off('connect');
      socket.off('disconnect');
      unsubscribeFromRoom('metrics');
    };
  }, []);
  
  return { metrics, connected };
}

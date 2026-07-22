import { useState, useEffect } from 'react';
import { getSocket, subscribeToRoom, unsubscribeFromRoom } from '../lib/websocket';

export interface AlertTriggeredDto {
  id: string;
  name: string;
  severity: string;
  timestamp: string;
}

export function useRealtimeAlerts() {
  const [alerts, setAlerts] = useState<AlertTriggeredDto[]>([]);
  
  useEffect(() => {
    const socket = getSocket();
    subscribeToRoom('alerts');
    socket.on('alert_triggered', (alert: AlertTriggeredDto) => {
      setAlerts(prev => [alert, ...prev].slice(0, 50));
    });
    return () => { 
      socket.off('alert_triggered'); 
      unsubscribeFromRoom('alerts'); 
    };
  }, []);
  
  return alerts;
}

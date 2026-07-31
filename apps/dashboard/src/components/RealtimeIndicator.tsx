'use client';
import { useRealtimeMetrics } from '../hooks/useRealtimeMetrics';

export function RealtimeIndicator() {
  const { metrics, connected } = useRealtimeMetrics();
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span className={`status-dot ${connected ? 'online pulse' : 'offline'}`} 
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: connected ? '#10b981' : '#9ca3af',
              display: 'inline-block',
              boxShadow: connected ? '0 0 0 0 rgba(16, 185, 129, 0.7)' : 'none',
              animation: connected ? 'pulse 2s infinite' : 'none'
            }}
      />
      {connected ? (
        <span style={{ color: '#6b7280' }}>
          Live · {metrics?.requestsPerSec?.toFixed(1) || '0'} req/s
        </span>
      ) : (
        <span style={{ color: '#6b7280' }}>Connecting...</span>
      )}
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
      `}</style>
    </div>
  );
}

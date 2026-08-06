'use client';
import { useRealtimeMetrics } from '../hooks/useRealtimeMetrics';
import { cn } from '@/lib/utils';

export function RealtimeIndicator() {
  const { metrics, connected } = useRealtimeMetrics();

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
      <span className="relative flex size-2">
        {connected && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
        )}
        <span className={cn('relative inline-flex size-2 rounded-full', connected ? 'bg-emerald-500' : 'bg-muted-foreground')} />
      </span>
      {connected ? (
        <span>Live &middot; {metrics?.requestsPerSec?.toFixed(1) || '0'} req/s</span>
      ) : (
        <span>Connecting&hellip;</span>
      )}
    </div>
  );
}

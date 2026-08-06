'use client';

import { useState } from 'react';
import { Play, Pause, Download } from 'lucide-react';
import { useRealtimeEvents } from '../../../hooks/useRealtimeEvents';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function LiveEventsPage() {
  const [isPaused, setIsPaused] = useState(false);
  const liveEvents = useRealtimeEvents(100);
  const [events, setEvents] = useState<any[]>([]);

  if (!isPaused && liveEvents !== events) {
    setEvents(liveEvents);
  }

  const [filterService, setFilterService] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const filteredEvents = events.filter(e => {
    if (filterService !== 'all' && e.service !== filterService) return false;
    if (filterStatus !== 'all') {
      const s = String(e.status);
      if (filterStatus === '2xx' && !s.startsWith('2')) return false;
      if (filterStatus === '4xx' && !s.startsWith('4')) return false;
      if (filterStatus === '5xx' && !s.startsWith('5')) return false;
    }
    return true;
  });

  const getStatusClass = (status: number) => {
    if (status < 300) return 'bg-emerald-500/10 text-emerald-500';
    if (status < 500) return 'bg-amber-500/10 text-amber-500';
    return 'bg-red-500/10 text-red-500';
  };

  const computeSummary = () => {
    if (filteredEvents.length === 0) return { rps: 0, cacheHit: 0, avgLat: 0 };
    const hits = filteredEvents.filter(e => e.cacheHit).length;
    const avgLat = filteredEvents.reduce((acc, e) => acc + e.latencyMs, 0) / filteredEvents.length;
    return {
      rps: filteredEvents.length / 3,
      cacheHit: Math.round((hits / filteredEvents.length) * 100),
      avgLat: Math.round(avgLat)
    };
  };

  const summary = computeSummary();

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(filteredEvents, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `events-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Live Events</h1>
          <p className="mt-1 text-sm text-muted-foreground">Real-time stream of incoming requests</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsPaused(!isPaused)}>
            {isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
            {isPaused ? 'Resume' : 'Pause'}
          </Button>
          <Button variant="outline" onClick={exportJSON}>
            <Download className="size-4" /> Export JSON
          </Button>
        </div>
      </div>

      <Card className="py-5">
        <CardContent className="flex flex-wrap gap-8 px-5 sm:justify-between">
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Visible Events</div>
            <div className="text-2xl font-bold text-foreground">{filteredEvents.length}</div>
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Avg Latency</div>
            <div className="text-2xl font-bold text-foreground">{summary.avgLat}ms</div>
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Cache Hit %</div>
            <div className="text-2xl font-bold text-foreground">{summary.cacheHit}%</div>
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 py-4">
        <div className="flex flex-wrap gap-3 px-5 pb-4">
          <Select value={filterService} onValueChange={setFilterService}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Services</SelectItem>
              <SelectItem value="gateway">Gateway</SelectItem>
              <SelectItem value="edge-a">Edge A</SelectItem>
              <SelectItem value="edge-b">Edge B</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="2xx">2xx Success</SelectItem>
              <SelectItem value="4xx">4xx Client Error</SelectItem>
              <SelectItem value="5xx">5xx Server Error</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Path</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Latency</TableHead>
              <TableHead>Cache</TableHead>
              <TableHead>Region</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEvents.map((evt, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs text-muted-foreground">{new Date(evt.time).toLocaleTimeString()}</TableCell>
                <TableCell className="text-xs">{evt.service}</TableCell>
                <TableCell className="text-xs font-semibold">{evt.method}</TableCell>
                <TableCell className="max-w-[280px] truncate text-xs">{evt.path}</TableCell>
                <TableCell>
                  <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-semibold', getStatusClass(evt.status))}>{evt.status}</span>
                </TableCell>
                <TableCell className="text-xs">{evt.latencyMs}ms</TableCell>
                <TableCell>
                  {evt.cacheHit ? <span className="text-xs font-semibold text-emerald-500">HIT</span> : <span className="text-xs text-muted-foreground">MISS</span>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{evt.edgeRegion || '-'}</TableCell>
              </TableRow>
            ))}
            {filteredEvents.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  No events found matching criteria.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

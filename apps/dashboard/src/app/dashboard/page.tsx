'use client';

import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { Activity, Zap, Server, Globe, ArrowUpRight, ArrowDownRight, AlertTriangle, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

const METHOD_COLORS: Record<string, string> = {
  GET: 'var(--blue)', POST: 'var(--green)', DELETE: 'var(--red)', PUT: 'var(--yellow)'
};

const STATUS_COLOR: Record<number, string> = {
  200: 'text-emerald-500 bg-emerald-500/10', 201: 'text-emerald-500 bg-emerald-500/10',
  204: 'text-blue-500 bg-blue-500/10', 400: 'text-amber-500 bg-amber-500/10',
  401: 'text-red-500 bg-red-500/10', 403: 'text-red-500 bg-red-500/10',
  404: 'text-amber-500 bg-amber-500/10', 500: 'text-red-500 bg-red-500/10', 502: 'text-red-500 bg-red-500/10',
};

function StatCard({
  label, value, change, icon: Icon, accentColor, iconBg, positive
}: {
  label: string; value: string | number; change?: string; positive?: boolean;
  icon: any; accentColor: string; iconBg: string;
}) {
  return (
    <Card className="gap-3 py-5">
      <CardContent className="px-5">
        <div
          className="mb-3 flex size-9 items-center justify-center rounded-md"
          style={{ background: iconBg, color: accentColor }}
        >
          <Icon className="size-[18px]" />
        </div>
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold tracking-tight text-foreground">{value}</div>
        {change && (
          <div className={cn('mt-2 flex items-center gap-1 text-xs font-medium', positive ? 'text-emerald-500' : 'text-red-500')}>
            {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {change} vs last hour
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EdgeServerCard({ name, region, status, cacheHit, requests, latency }: {
  name: string; region: string; status: string;
  cacheHit: string; requests: string; latency: string;
}) {
  return (
    <Card className="min-w-[280px] flex-1 py-5">
      <CardContent className="px-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-brand text-white">
            <Server className="size-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">{name}</div>
            <div className="text-xs text-muted-foreground">{region}</div>
          </div>
          <Badge
            variant="outline"
            className={cn('ml-auto gap-1.5', status === 'online' ? 'border-emerald-500/30 text-emerald-500' : 'border-red-500/30 text-red-500')}
          >
            <span className={cn('size-1.5 rounded-full', status === 'online' ? 'bg-emerald-500' : 'bg-red-500')} />
            {status}
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Cache Hit', value: cacheHit },
            { label: 'Requests', value: requests },
            { label: 'Latency', value: latency },
          ].map((m) => (
            <div key={m.label} className="rounded-md border border-border bg-muted/40 px-2 py-3 text-center">
              <div className="text-base font-bold text-foreground">{m.value}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">{m.label}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024, dm = decimals < 0 ? 0 : decimals, sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function DashboardOverview() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [rateData, setRateData] = useState<any[]>([]);
  const [cacheRatioSeries, setCacheRatioSeries] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const [sumData, events, rate, cacheSeries, edgeStats] = await Promise.all([
        api.get<any>('/v1/analytics/summary'),
        api.get<any[]>('/v1/analytics/events/recent?limit=10'),
        api.get<any[]>('/v1/analytics/requests/rate?window=60'),
        api.get<any[]>('/v1/analytics/cache/ratio/timeseries?window=60'),
        api.get<any[]>('/v1/analytics/edges?window=60'),
      ]);
      setSummary(sumData);
      setRecentEvents(events);
      setRateData(rate);
      setCacheRatioSeries(cacheSeries);
      setEdges(edgeStats);
    } catch (err) {
      console.error('Failed to fetch analytics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  if (loading && !summary) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-brand">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  const stats = summary || { totalRequests: 0, cacheHitRatio: 0, totalBandwidthBytes: 0, errorRate: 0 };
  const hitRatio = (stats.cacheHitRatio * 100).toFixed(1);
  const errorRatio = (stats.errorRate * 100).toFixed(2);
  const liveRPS = rateData.length > 0 ? +(rateData[rateData.length - 1].value / 60).toFixed(1) : 0;

  const cacheRatioByBucket = new Map(cacheRatioSeries.map((c) => [String(c.t), c.value]));
  const chartData = rateData.length > 0 ? rateData.map(d => ({
    time: new Date(d.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    requests: d.value,
    cacheHitPct: cacheRatioByBucket.get(String(d.t)) ?? 0,
  })) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Platform Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">Real-time metrics across all EdgeSphere services</p>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-500">
          <Activity className="size-4 animate-pulse" />
          {liveRPS.toLocaleString()} req/s
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Requests" value={stats.totalRequests.toLocaleString()} positive icon={Activity} accentColor="var(--brand)" iconBg="var(--brand-glow)" />
        <StatCard label="Cache Hit Ratio" value={`${hitRatio}%`} positive icon={Zap} accentColor="var(--green)" iconBg="var(--green-bg)" />
        <StatCard label="Bandwidth Served" value={formatBytes(stats.totalBandwidthBytes)} positive icon={Globe} accentColor="var(--brand)" iconBg="var(--brand-glow)" />
        <StatCard label="Error Rate" value={`${errorRatio}%`} icon={AlertTriangle} accentColor="var(--red)" iconBg="var(--red-bg)" />
      </div>

      <Card className="py-5">
        <CardHeader className="flex-row items-center justify-between gap-4 px-5">
          <div>
            <CardTitle>Request Volume</CardTitle>
            <CardDescription>Total requests in real-time</CardDescription>
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-sm bg-brand" />
              Requests
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-sm bg-emerald-500" />
              Cache Hit %
            </span>
          </div>
        </CardHeader>
        <CardContent className="px-5">
          <ResponsiveContainer width="100%" height={220}>
            {chartData.length > 0 ? (
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="reqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--brand)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="cacheGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--green)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--green)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="requests" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} width={40} />
                <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} width={36} />
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: 'var(--text-primary)' }} />
                <Area yAxisId="requests" type="monotone" dataKey="requests" stroke="var(--brand)" strokeWidth={2} fill="url(#reqGrad)" name="Requests" />
                <Area yAxisId="pct" type="monotone" dataKey="cacheHitPct" stroke="var(--green)" strokeWidth={2} fill="url(#cacheGrad)" name="Cache Hit %" />
              </AreaChart>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Waiting for traffic data...
              </div>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 text-base font-semibold text-foreground">Edge Servers</h2>
        <div className="flex flex-wrap gap-5">
          {edges.length > 0 ? edges.map((edge) => {
            const isOnline = Date.now() - new Date(edge.lastSeen).getTime() < 5 * 60 * 1000;
            return (
              <EdgeServerCard
                key={edge.region}
                name={`Edge ${edge.region}`}
                region={edge.region}
                status={isOnline ? 'online' : 'offline'}
                cacheHit={`${Math.round(edge.cacheHitRatio * 100)}%`}
                requests={edge.requests.toLocaleString()}
                latency={`${Math.round(edge.avgLatencyMs)}ms`}
              />
            );
          }) : (
            <Card className="flex-1 py-8">
              <CardContent className="text-center text-muted-foreground">
                No edge servers have reported traffic in this window yet.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-base font-semibold text-foreground">Recent Requests</h2>
        <Card className="gap-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Method</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Latency</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentEvents.length > 0 ? recentEvents.map((req, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <span
                      className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] font-bold"
                      style={{ color: METHOD_COLORS[req.method] || 'var(--text-primary)' }}
                    >
                      {req.method}
                    </span>
                  </TableCell>
                  <TableCell className="min-w-[200px] max-w-[320px] truncate font-mono text-xs">{req.path}</TableCell>
                  <TableCell>
                    <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold', STATUS_COLOR[req.status] || 'bg-muted text-muted-foreground')}>
                      {req.status}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{req.latencyMs}ms</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">{req.ip}</Badge>
                  </TableCell>
                  <TableCell className="min-w-[100px] text-xs text-muted-foreground">
                    {new Date(req.time).toLocaleTimeString()}
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No recent API traffic found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

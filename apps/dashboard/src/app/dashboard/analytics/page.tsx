'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { AlertCircle } from 'lucide-react';

import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

const BASE = '/v1/analytics';

const fetcher = (url: string): Promise<any> => api.get<any>(url);

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  color: 'var(--text-primary)',
  fontSize: '12px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
};

const TIME_RANGES = [
  { label: '1h', val: '60' },
  { label: '6h', val: '360' },
  { label: '24h', val: '1440' },
  { label: '7d', val: '10080' },
];

export default function AnalyticsPage() {
  const [windowTime, setWindowTime] = useState('60');

  const { data: summaryData, error: summaryError } = useSWR(`${BASE}/summary?window=${windowTime}`, fetcher, { refreshInterval: 10000 });
  const { data: rateData } = useSWR(`${BASE}/requests/rate?window=${windowTime}`, fetcher, { refreshInterval: 15000 });
  const { data: latencyData } = useSWR(`${BASE}/latency/percentiles?window=${windowTime}`, fetcher, { refreshInterval: 30000 });
  const { data: cacheData } = useSWR(`${BASE}/cache/ratio?window=${windowTime}`, fetcher, { refreshInterval: 15000 });
  const { data: geoData } = useSWR(`${BASE}/geo?window=${windowTime}`, fetcher, { refreshInterval: 30000 });
  const { data: pathsData } = useSWR(`${BASE}/requests/top-paths?window=${windowTime}`, fetcher, { refreshInterval: 30000 });
  const { data: errorData } = useSWR(`${BASE}/errors?window=${windowTime}`, fetcher, { refreshInterval: 15000 });

  const summary: any = summaryData || { totalRequests: 0, cacheHitRatio: 0, p95Latency: 0, totalBandwidthBytes: 0, errorRate: 0 };
  const rateSeries = Array.isArray(rateData) ? rateData : [];
  const latencySeries = latencyData ? [{ t: new Date().toISOString(), ...latencyData }] : [];
  const cacheRatio: any = cacheData || { hits: 0, misses: 0, hitRatio: 0 };
  const geoStats = Array.isArray(geoData) ? geoData : [];
  const topPaths = Array.isArray(pathsData) ? pathsData : [];
  const errors = Array.isArray(errorData) ? errorData : [];

  const PIE_DATA = [
    { name: 'Cache Hit', value: cacheRatio.hits || 0, color: '#22c55e' },
    { name: 'Cache Miss', value: cacheRatio.misses || 0, color: '#ef4444' }
  ];

  const kpis = [
    { label: 'Total Requests', value: summary.totalRequests.toLocaleString(), color: 'var(--brand)' },
    { label: 'Cache Hit Rate', value: `${(summary.cacheHitRatio * 100).toFixed(1)}%`, color: 'var(--green)' },
    { label: 'P95 Latency', value: `${Math.round(summary.p95Latency)}ms`, color: 'var(--blue)' },
    { label: 'Bandwidth', value: `${(summary.totalBandwidthBytes / (1024 * 1024)).toFixed(2)} MB`, color: 'var(--yellow)' },
    { label: 'Error Rate', value: `${(summary.errorRate * 100).toFixed(2)}%`, color: 'var(--red)' },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Real-time request metrics, cache performance, and traffic insights</p>
        </div>
        <div className="flex w-fit gap-1 rounded-md border border-border bg-muted/40 p-1">
          {TIME_RANGES.map((range) => (
            <Button
              key={range.val}
              size="sm"
              variant={windowTime === range.val ? 'default' : 'ghost'}
              className="h-7 px-3"
              onClick={() => setWindowTime(range.val)}
            >
              {range.label}
            </Button>
          ))}
        </div>
      </div>

      {summaryError && (
        <div className="mb-6 flex items-center gap-2 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4" /> Error loading analytics data. Retrying...
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="gap-1.5 rounded-lg border-t-2 py-4" style={{ borderTopColor: kpi.color }}>
            <CardContent className="px-4">
              <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{kpi.label}</div>
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {!summaryData && !summaryError ? '...' : kpi.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Requests Rate</CardTitle>
            <CardDescription>Requests over time</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={rateSeries}>
                <defs>
                  <linearGradient id="reqG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(l) => new Date(l).toLocaleTimeString()} />
                <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} fill="url(#reqG)" name="Requests" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Cache Hit Ratio</CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <div className="mb-3 flex justify-center">
              <PieChart width={160} height={160}>
                <Pie data={PIE_DATA} cx={75} cy={75} innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                  {PIE_DATA.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </div>
            <div className="flex flex-col gap-2">
              {PIE_DATA.map((d) => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-block size-2.5 rounded-sm" style={{ background: d.color }} />
                    <span className="text-xs text-muted-foreground">{d.name}</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">{d.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Response Latency</CardTitle>
            <CardDescription>P50 / P95 / P99 over time</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={latencySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="p50" stroke="#22c55e" strokeWidth={2} dot={false} name="P50" />
                <Line type="monotone" dataKey="p95" stroke="#eab308" strokeWidth={2} dot={false} name="P95" />
                <Line type="monotone" dataKey="p99" stroke="#ef4444" strokeWidth={2} dot={false} name="P99" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Geographic Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-5">
            {geoStats.map((geo: any) => (
              <div key={geo.country}>
                <div className="mb-1 flex justify-between">
                  <span className="text-xs text-muted-foreground">{geo.country || 'Unknown'}</span>
                  <span className="text-xs font-semibold text-foreground">{geo.requests.toLocaleString()} ({geo.pct}%)</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${geo.pct}%` }} />
                </div>
              </div>
            ))}
            {geoStats.length === 0 && (
              <div className="py-5 text-center text-sm text-muted-foreground">No geographic data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="gap-0 py-0">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-base font-semibold">Top Paths</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Path</TableHead>
                <TableHead>Requests</TableHead>
                <TableHead>Avg Latency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topPaths.map((p: any, i: number) => (
                <TableRow key={i}>
                  <TableCell><code className="text-xs">{p.path}</code></TableCell>
                  <TableCell>{p.count.toLocaleString()}</TableCell>
                  <TableCell>{Math.round(p.avgLatency)}ms</TableCell>
                </TableRow>
              ))}
              {topPaths.length === 0 && (
                <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">No path data</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <Card className="gap-0 py-0">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-base font-semibold">Errors</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {errors.map((e: any, i: number) => (
                <TableRow key={i}>
                  <TableCell><Badge variant="destructive">{e.status}</Badge></TableCell>
                  <TableCell>{e.count.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {errors.length === 0 && (
                <TableRow><TableCell colSpan={2} className={cn('py-6 text-center text-muted-foreground')}>No errors</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

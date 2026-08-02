'use client';

import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { Activity, Zap, Server, Globe, ArrowUpRight, ArrowDownRight, Database, Users, AlertTriangle, Loader2 } from 'lucide-react';
import api from '@/lib/api';

const METHOD_COLORS: Record<string, string> = {
  GET: 'var(--blue)', POST: 'var(--green)', DELETE: 'var(--red)', PUT: 'var(--yellow)'
};

const STATUS_CLASS: Record<number, string> = {
  200: 'badge-green', 201: 'badge-green', 204: 'badge-blue', 400: 'badge-yellow', 401: 'badge-red', 403: 'badge-red', 404: 'badge-yellow', 500: 'badge-red', 502: 'badge-red'
};

function StatCard({
  label, value, change, icon: Icon, accentColor, iconBg, positive
}: {
  label: string; value: string | number; change?: string; positive?: boolean;
  icon: any; accentColor: string; iconBg: string;
}) {
  return (
    <div className="stat-card" style={{ '--accent-color': accentColor } as React.CSSProperties}>
      <div className="stat-icon" style={{ '--icon-bg': iconBg, color: accentColor } as React.CSSProperties}>
        <Icon size={18} />
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {change && (
        <div className={`stat-change ${positive ? 'up' : 'down'}`}>
          {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {change} vs last hour
        </div>
      )}
    </div>
  );
}

function EdgeServerCard({ name, region, status, cacheHit, requests, latency }: {
  name: string; region: string; status: string;
  cacheHit: string; requests: string; latency: string;
}) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 280 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 'var(--radius-sm)',
          background: 'var(--brand)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}><Server size={20} /></div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{region}</div>
        </div>
        <span className={`badge badge-${status === 'online' ? 'green' : 'red'}`} style={{ marginLeft: 'auto' }}>
          <span className={`status-dot ${status}`} style={{ width: 6, height: 6 }} /> {status}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {[
          { label: 'Cache Hit', value: cacheHit },
          { label: 'Requests', value: requests },
          { label: 'Latency', value: latency },
        ].map(m => (
          <div key={m.label} style={{ textAlign: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 8px' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{m.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const CustomTooltipStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '10px 14px',
  fontSize: 12,
  color: 'var(--text-primary)',
  boxShadow: 'var(--shadow-md)'
};

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
    const interval = setInterval(fetchData, 5000); // Live poll every 5s
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  if (loading && !summary) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'var(--brand)' }}>
        <Loader2 size={32} className="spinner" />
      </div>
    );
  }

  // Fallbacks if data is zero/missing from brand new DB
  const stats = summary || { totalRequests: 0, cacheHitRatio: 0, totalBandwidthBytes: 0, errorRate: 0 };
  const hitRatio = (stats.cacheHitRatio * 100).toFixed(1);
  const errorRatio = (stats.errorRate * 100).toFixed(2);
  const liveRPS = rateData.length > 0 ? +(rateData[rateData.length - 1].value / 60).toFixed(1) : 0;

  // Transform rateData for the chart, joining in the real cache-hit-ratio time series by bucket
  const cacheRatioByBucket = new Map(cacheRatioSeries.map((c) => [String(c.t), c.value]));
  const chartData = rateData.length > 0 ? rateData.map(d => ({
    time: new Date(d.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    requests: d.value,
    cacheHitPct: cacheRatioByBucket.get(String(d.t)) ?? 0,
  })) : [];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Platform Overview</h1>
          <p className="page-subtitle">Real-time metrics across all EdgeSphere services</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            background: 'var(--green-bg)', border: '1px solid rgba(46,160,67,0.2)',
            borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 13,
            color: 'var(--green)', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 8
          }}>
            <Activity size={16} className="pulse" />
            {liveRPS.toLocaleString()} req/s
          </div>
        </div>
      </div>

      {/* Stat Grid */}
      <div className="stat-grid" style={{ marginBottom: 28 }}>
        <StatCard label="Total Requests" value={stats.totalRequests.toLocaleString()} positive icon={Activity} accentColor="var(--brand)" iconBg="var(--brand-glow)" />
        <StatCard label="Cache Hit Ratio" value={`${hitRatio}%`} positive icon={Zap} accentColor="var(--green)" iconBg="var(--green-bg)" />
        <StatCard label="Bandwidth Served" value={formatBytes(stats.bandwidth)} positive icon={Globe} accentColor="var(--brand)" iconBg="var(--brand-glow)" />
        <StatCard label="Error Rate" value={`${errorRatio}%`} icon={AlertTriangle} accentColor="var(--red)" iconBg="var(--red-bg)" />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 28 }}>
        {/* Request Volume Chart */}
        <div className="card" style={{ gridColumn: '1 / -1', '@media (min-width: 1024px)': { gridColumn: 'span 2' } } as any}>
          <div className="card-header">
            <div>
              <div className="card-title">Request Volume</div>
              <div className="card-description">Total requests in real-time</div>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--brand)', display: 'inline-block' }} />
                Requests
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--green)', display: 'inline-block' }} />
                Cache Hit %
              </span>
            </div>
          </div>
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
                <Tooltip contentStyle={CustomTooltipStyle} />
                <Area yAxisId="requests" type="monotone" dataKey="requests" stroke="var(--brand)" strokeWidth={2} fill="url(#reqGrad)" name="Requests" />
                <Area yAxisId="pct" type="monotone" dataKey="cacheHitPct" stroke="var(--green)" strokeWidth={2} fill="url(#cacheGrad)" name="Cache Hit %" />
              </AreaChart>
            ) : (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                Waiting for traffic data...
              </div>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Edge Servers */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            Edge Servers
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
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
            <div className="card" style={{ flex: 1, color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>
              No edge servers have reported traffic in this window yet.
            </div>
          )}
        </div>
      </div>

      {/* Recent Requests */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Recent Requests</h2>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Method</th>
                <th>Path</th>
                <th>Status</th>
                <th>Latency</th>
                <th>IP</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.length > 0 ? recentEvents.map((req, i) => (
                <tr key={i}>
                  <td>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                      color: METHOD_COLORS[req.method] || 'var(--text-primary)',
                      background: 'var(--bg-elevated)', padding: '3px 8px', borderRadius: 'var(--radius-sm)'
                    }}>
                      {req.method}
                    </span>
                  </td>
                  <td style={{ minWidth: 200 }}>
                    <code style={{ wordBreak: 'break-all' }}>{req.path}</code>
                  </td>
                  <td>
                    <span className={`badge ${STATUS_CLASS[req.status] || 'badge-secondary'}`}>
                      {req.status}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{req.latencyMs}ms</td>
                  <td><span className="badge badge-secondary">{req.ip}</span></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12, minWidth: 100 }}>
                    {new Date(req.time).toLocaleTimeString()}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px' }}>
                    <div style={{ color: 'var(--text-muted)' }}>No recent API traffic found.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

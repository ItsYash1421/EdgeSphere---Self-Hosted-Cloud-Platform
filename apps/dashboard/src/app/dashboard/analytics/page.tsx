'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

import api from '@/lib/api';

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

export default function AnalyticsPage() {
  const [windowTime, setWindowTime] = useState('60'); // default 1h = 60m

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

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Real-time request metrics, cache performance, and traffic insights</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: '1h', val: '60' },
            { label: '6h', val: '360' },
            { label: '24h', val: '1440' },
            { label: '7d', val: '10080' }
          ].map(range => (
            <button 
              key={range.val} 
              onClick={() => setWindowTime(range.val)}
              className={`btn btn-sm ${windowTime === range.val ? 'btn-primary' : 'btn-secondary'}`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {summaryError && (
        <div style={{ background: 'var(--red)20', color: 'var(--red)', padding: 12, borderRadius: 8, marginBottom: 24, fontSize: 13 }}>
          Error loading analytics data. Retrying...
        </div>
      )}

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Requests', value: summary.totalRequests.toLocaleString(), color: 'var(--brand)' },
          { label: 'Cache Hit Rate', value: `${(summary.cacheHitRatio * 100).toFixed(1)}%`, color: 'var(--green)' },
          { label: 'P95 Latency', value: `${Math.round(summary.p95Latency)}ms`, color: 'var(--blue)' },
          { label: 'Bandwidth', value: `${(summary.totalBandwidthBytes / (1024*1024)).toFixed(2)} MB`, color: 'var(--yellow)' },
          { label: 'Error Rate', value: `${(summary.errorRate * 100).toFixed(2)}%`, color: 'var(--red)' },
        ].map(kpi => (
          <div key={kpi.label} style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: '16px', borderTop: `2px solid ${kpi.color}`
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              {!summaryData && !summaryError ? '...' : kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Requests Rate</div>
              <div className="card-description">Requests over time</div>
            </div>
          </div>
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
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Cache Hit Ratio</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <PieChart width={160} height={160}>
              <Pie data={PIE_DATA} cx={75} cy={75} innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                {PIE_DATA.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PIE_DATA.map(d => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color, display: 'inline-block' }} />
                  <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{d.name}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{d.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Response Latency</div>
            <div className="card-description">P50 / P95 / P99 over time</div>
          </div>
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
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Geographic Distribution</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {geoStats.map((geo: any) => (
              <div key={geo.country}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{geo.country || 'Unknown'}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {geo.requests.toLocaleString()} ({geo.pct}%)
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${geo.pct}%`, background: 'var(--brand)' }} />
                </div>
              </div>
            ))}
            {geoStats.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>
                No geographic data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Top Paths & Errors */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Top Paths</h3>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Path</th>
                <th>Requests</th>
                <th>Avg Latency</th>
              </tr>
            </thead>
            <tbody>
              {topPaths.map((p: any, i: number) => (
                <tr key={i}>
                  <td><code style={{ fontSize: 12 }}>{p.path}</code></td>
                  <td>{p.count.toLocaleString()}</td>
                  <td>{Math.round(p.avgLatency)}ms</td>
                </tr>
              ))}
              {topPaths.length === 0 && (
                <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20 }}>No path data</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Errors</h3>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((e: any, i: number) => (
                <tr key={i}>
                  <td><span className="badge" style={{ background: 'var(--red)20', color: 'var(--red)' }}>{e.status}</span></td>
                  <td>{e.count.toLocaleString()}</td>
                </tr>
              ))}
              {errors.length === 0 && (
                <tr><td colSpan={2} style={{ textAlign: 'center', padding: 20 }}>No errors</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

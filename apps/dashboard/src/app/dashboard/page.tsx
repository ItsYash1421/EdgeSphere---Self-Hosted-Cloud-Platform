'use client';

import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';

// Mock data — will be replaced by real API calls in Phase 3
const generateTimeData = (points: number) =>
  Array.from({ length: points }, (_, i) => ({
    time: `${String(Math.floor(i * (24 / points))).padStart(2, '0')}:00`,
    requests: Math.floor(Math.random() * 3000 + 500),
    cacheHit: Math.floor(Math.random() * 800 + 200),
    latency: Math.floor(Math.random() * 80 + 20),
  }));

const MOCK_STATS = {
  totalRequests: '2.4M',
  cacheHitRatio: '84.2%',
  avgLatency: '38ms',
  storageUsed: '12.6 GB',
  bandwidth: '847 GB',
  activeUsers: '1,247',
  errorRate: '0.08%',
  edgesOnline: 2,
};

const MOCK_RECENT = [
  { id: '1', method: 'GET', path: '/cdn/assets/hero.webp', status: 200, cache: 'HIT', latency: '12ms', ip: '103.21.x.x', country: '🇮🇳', time: '2s ago' },
  { id: '2', method: 'POST', path: '/v1/storage/buckets', status: 201, cache: '—', latency: '145ms', ip: '198.51.x.x', country: '🇺🇸', time: '5s ago' },
  { id: '3', method: 'GET', path: '/cdn/videos/demo.mp4', status: 200, cache: 'MISS', latency: '324ms', ip: '92.168.x.x', country: '🇩🇪', time: '8s ago' },
  { id: '4', method: 'DELETE', path: '/v1/storage/files/old.jpg', status: 204, cache: '—', latency: '87ms', ip: '45.33.x.x', country: '🇬🇧', time: '12s ago' },
  { id: '5', method: 'GET', path: '/cdn/assets/logo.svg', status: 200, cache: 'HIT', latency: '8ms', ip: '103.21.x.x', country: '🇮🇳', time: '15s ago' },
];

const METHOD_COLORS: Record<string, string> = {
  GET: 'var(--blue)', POST: 'var(--green)', DELETE: 'var(--red)', PUT: 'var(--yellow)'
};

const STATUS_CLASS: Record<number, string> = {
  200: 'badge-green', 201: 'badge-green', 204: 'badge-blue', 400: 'badge-yellow', 500: 'badge-red'
};

function StatCard({
  label, value, change, icon, accentColor, iconBg
}: {
  label: string; value: string; change?: string; positive?: boolean;
  icon: string; accentColor: string; iconBg: string;
}) {
  return (
    <div className="stat-card" style={{ '--accent-color': accentColor } as React.CSSProperties}>
      <div className="stat-icon" style={{ '--icon-bg': iconBg } as React.CSSProperties}>
        <span style={{ fontSize: 16 }}>{icon}</span>
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {change && (
        <div className="stat-change up">
          ↑ {change} vs last hour
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
    <div className="card" style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
        }}>⚡</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{region}</div>
        </div>
        <span className={`badge badge-${status === 'online' ? 'green' : 'red'}`} style={{ marginLeft: 'auto' }}>
          ● {status}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {[
          { label: 'Cache Hit', value: cacheHit },
          { label: 'Requests', value: requests },
          { label: 'Latency', value: latency },
        ].map(m => (
          <div key={m.label} style={{ textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 8px' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{m.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const CustomTooltipStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 12,
  color: 'var(--text-primary)',
};

export default function DashboardOverview() {
  const [timeData, setTimeData] = useState(generateTimeData(24));
  const [liveRPS, setLiveRPS] = useState(1842);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString());
    const interval = setInterval(() => {
      setLiveRPS(Math.floor(Math.random() * 800 + 1500));
      setCurrentTime(new Date().toLocaleTimeString());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Platform Overview</h1>
          <p className="page-subtitle">Real-time metrics across all EdgeSphere services</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '6px 14px', fontSize: 13,
            color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)'
          }}>
            🕐 {currentTime}
          </div>
          <div style={{
            background: 'var(--green-bg)', border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 8, padding: '6px 14px', fontSize: 13,
            color: 'var(--green)', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6
          }}>
            <span className="status-dot online pulse" />
            {liveRPS.toLocaleString()} req/s
          </div>
        </div>
      </div>

      {/* Stat Grid */}
      <div className="stat-grid" style={{ marginBottom: 28 }}>
        <StatCard label="Total Requests" value={MOCK_STATS.totalRequests} change="12.4%" icon="📡" accentColor="var(--brand)" iconBg="var(--brand-glow)" />
        <StatCard label="Cache Hit Ratio" value={MOCK_STATS.cacheHitRatio} change="2.1%" icon="⚡" accentColor="var(--green)" iconBg="var(--green-bg)" />
        <StatCard label="Avg Latency" value={MOCK_STATS.avgLatency} icon="⏱️" accentColor="var(--blue)" iconBg="var(--blue-bg)" />
        <StatCard label="Storage Used" value={MOCK_STATS.storageUsed} change="430 MB" icon="🗄️" accentColor="var(--yellow)" iconBg="var(--yellow-bg)" />
        <StatCard label="Bandwidth Served" value={MOCK_STATS.bandwidth} change="8.7%" icon="🌐" accentColor="var(--brand)" iconBg="var(--brand-glow)" />
        <StatCard label="Active Users" value={MOCK_STATS.activeUsers} change="87" icon="👥" accentColor="var(--green)" iconBg="var(--green-bg)" />
        <StatCard label="Error Rate" value={MOCK_STATS.errorRate} icon="⚠️" accentColor="var(--red)" iconBg="var(--red-bg)" />
        <StatCard label="Edges Online" value={`${MOCK_STATS.edgesOnline}/2`} icon="🌍" accentColor="var(--green)" iconBg="var(--green-bg)" />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Request Volume Chart */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Request Volume</div>
              <div className="card-description">Total requests over 24 hours</div>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--brand)', display: 'inline-block' }} />
                Requests
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--green)', display: 'inline-block' }} />
                Cache Hits
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={timeData}>
              <defs>
                <linearGradient id="reqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cacheGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={CustomTooltipStyle} />
              <Area type="monotone" dataKey="requests" stroke="#6366f1" strokeWidth={2} fill="url(#reqGrad)" />
              <Area type="monotone" dataKey="cacheHit" stroke="#22c55e" strokeWidth={2} fill="url(#cacheGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Latency Chart */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Latency (ms)</div>
              <div className="card-description">Average response time</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={timeData.slice(0, 12)}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={CustomTooltipStyle} />
              <Bar dataKey="latency" fill="#6366f1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Edge Servers */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Edge Servers</h2>
          <a href="/dashboard/edges" style={{ fontSize: 13, color: 'var(--brand-light)', textDecoration: 'none' }}>View all →</a>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <EdgeServerCard name="Edge A" region="us-east-1" status="online" cacheHit="87%" requests="1.2K/s" latency="18ms" />
          <EdgeServerCard name="Edge B" region="eu-west-1" status="online" cacheHit="81%" requests="640/s" latency="24ms" />
        </div>
      </div>

      {/* Recent Requests */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Recent Requests</h2>
          <a href="/dashboard/logs" style={{ fontSize: 13, color: 'var(--brand-light)', textDecoration: 'none' }}>View all logs →</a>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Method</th>
                <th>Path</th>
                <th>Status</th>
                <th>Cache</th>
                <th>Latency</th>
                <th>Country</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_RECENT.map(req => (
                <tr key={req.id}>
                  <td>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                      color: METHOD_COLORS[req.method] || 'var(--text-primary)',
                      background: 'var(--bg-elevated)', padding: '2px 7px', borderRadius: 4
                    }}>
                      {req.method}
                    </span>
                  </td>
                  <td>
                    <code style={{ fontSize: 12 }}>{req.path}</code>
                  </td>
                  <td>
                    <span className={`badge ${STATUS_CLASS[req.status] || 'badge-brand'}`}>
                      {req.status}
                    </span>
                  </td>
                  <td>
                    {req.cache === 'HIT' ? (
                      <span className="badge badge-green">⚡ HIT</span>
                    ) : req.cache === 'MISS' ? (
                      <span className="badge badge-yellow">MISS</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{req.latency}</td>
                  <td>{req.country}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{req.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

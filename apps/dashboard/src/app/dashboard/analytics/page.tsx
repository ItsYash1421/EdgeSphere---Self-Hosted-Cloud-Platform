'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

const generateData = (n: number) => Array.from({ length: n }, (_, i) => ({
  time: `${String(i).padStart(2, '0')}:00`,
  requests: Math.floor(Math.random() * 5000 + 1000),
  errors: Math.floor(Math.random() * 50),
  cacheHit: Math.floor(Math.random() * 3000 + 500),
  latency: Math.floor(Math.random() * 100 + 15),
  bandwidth: Math.floor(Math.random() * 500 + 100),
}));

const GEO_DATA = [
  { country: '🇮🇳 India', requests: 842340, pct: 34 },
  { country: '🇺🇸 United States', requests: 623112, pct: 25 },
  { country: '🇩🇪 Germany', requests: 312445, pct: 12 },
  { country: '🇬🇧 United Kingdom', requests: 248901, pct: 10 },
  { country: '🇯🇵 Japan', requests: 198234, pct: 8 },
  { country: '🌍 Others', requests: 274968, pct: 11 },
];

const PIE_DATA = [
  { name: 'Cache HIT', value: 84.2, color: '#22c55e' },
  { name: 'Cache MISS', value: 15.8, color: '#6366f1' },
];

const TOP_FILES = [
  { key: 'assets/hero.webp', hits: 48293, size: '245 KB', bandwidth: '11.2 GB' },
  { key: 'videos/demo.mp4', hits: 12847, size: '50 MB', bandwidth: '625 GB' },
  { key: 'css/main.css', hits: 38201, size: '42 KB', bandwidth: '1.6 GB' },
  { key: 'js/bundle.js', hits: 35092, size: '280 KB', bandwidth: '9.5 GB' },
  { key: 'images/logo.svg', hits: 28439, size: '8 KB', bandwidth: '222 MB' },
];

const TOOLTIP_STYLE = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 12,
  color: 'var(--text-primary)',
};

export default function AnalyticsPage() {
  const data = generateData(24);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Request metrics, cache performance, and traffic insights</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['1h', '24h', '7d', '30d'].map(range => (
            <button key={range} className={`btn btn-sm ${range === '24h' ? 'btn-primary' : 'btn-secondary'}`}>
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Requests', value: '2.4M', sub: '+12.4%', color: 'var(--brand)' },
          { label: 'Cache Hit Rate', value: '84.2%', sub: '+2.1%', color: 'var(--green)' },
          { label: 'P95 Latency', value: '94ms', sub: '-8ms', color: 'var(--blue)' },
          { label: 'Bandwidth', value: '847 GB', sub: '+8.7%', color: 'var(--yellow)' },
          { label: 'Error Rate', value: '0.08%', sub: '-0.01%', color: 'var(--red)' },
        ].map(kpi => (
          <div key={kpi.label} style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: '16px', borderTop: `2px solid ${kpi.color}`
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--green)', marginTop: 4, fontWeight: 500 }}>
              {kpi.sub} vs yesterday
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Requests & Cache Hits</div>
              <div className="card-description">24-hour traffic volume</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="reqG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cacheG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="requests" stroke="#6366f1" strokeWidth={2} fill="url(#reqG)" name="Requests" />
              <Area type="monotone" dataKey="cacheHit" stroke="#22c55e" strokeWidth={2} fill="url(#cacheG)" name="Cache Hits" />
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
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{d.value}%</span>
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
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="latency" stroke="#6366f1" strokeWidth={2} dot={false} name="Avg Latency" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Geographic Distribution</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {GEO_DATA.map(geo => (
              <div key={geo.country}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{geo.country}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {(geo.requests / 1000).toFixed(0)}K ({geo.pct}%)
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${geo.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Files */}
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Top Accessed Files</h2>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>File</th>
                <th>Cache Hits</th>
                <th>File Size</th>
                <th>Bandwidth</th>
              </tr>
            </thead>
            <tbody>
              {TOP_FILES.map((f, i) => (
                <tr key={f.key}>
                  <td style={{ color: 'var(--text-muted)', fontWeight: 600, width: 40 }}>{i + 1}</td>
                  <td><code style={{ fontSize: 12 }}>{f.key}</code></td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{f.hits.toLocaleString()}</td>
                  <td><span className="badge badge-brand">{f.size}</span></td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{f.bandwidth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

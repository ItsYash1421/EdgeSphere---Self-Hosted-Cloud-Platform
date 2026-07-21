'use client';

export default function EdgesPage() {
  const edges = [
    { name: 'Edge A', region: 'us-east-1', status: 'online', ip: '10.0.0.10', cacheHit: '87%', rps: '1,247', latency: '18ms', uptime: '99.98%', cacheSize: '4.2 GB' },
    { name: 'Edge B', region: 'eu-west-1', status: 'online', ip: '10.0.0.11', cacheHit: '81%', rps: '643', latency: '24ms', uptime: '99.95%', cacheSize: '2.8 GB' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Edge Servers</h1>
          <p className="page-subtitle">Monitor CDN edge nodes and cache performance</p>
        </div>
        <button className="btn btn-primary">+ Add Edge</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {edges.map(edge => (
          <div key={edge.name} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22
              }}>⚡</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{edge.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{edge.region} · {edge.ip}</div>
              </div>
              <span className="badge badge-green">● {edge.status}</span>
              <button className="btn btn-secondary btn-sm">🔄 Purge Cache</button>
              <button className="btn btn-secondary btn-sm">⚙️ Configure</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
              {[
                { label: 'Cache Hit Rate', value: edge.cacheHit, color: 'var(--green)' },
                { label: 'Requests/sec', value: edge.rps, color: 'var(--brand)' },
                { label: 'Avg Latency', value: edge.latency, color: 'var(--blue)' },
                { label: 'Uptime', value: edge.uptime, color: 'var(--green)' },
                { label: 'Cache Size', value: edge.cacheSize, color: 'var(--yellow)' },
              ].map(m => (
                <div key={m.label} style={{
                  background: 'var(--bg-elevated)', borderRadius: 10,
                  padding: '14px 16px', borderTop: `2px solid ${m.color}`
                }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{m.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

export default function MonitoringPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Monitoring</h1>
          <p className="page-subtitle">Grafana, Prometheus, and Jaeger dashboards</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {[
          { name: 'Grafana', desc: 'Metrics dashboards and alerting', url: 'http://localhost:3200', icon: '📈', color: '#f46800', status: 'online' },
          { name: 'Prometheus', desc: 'Metrics collection and querying', url: 'http://localhost:9090', icon: '🔥', color: '#e6522c', status: 'online' },
          { name: 'Jaeger', desc: 'Distributed request tracing', url: 'http://localhost:16686', icon: '🔍', color: '#60d0e4', status: 'online' },
          { name: 'Loki', desc: 'Log aggregation and search', url: 'http://localhost:3100', icon: '📋', color: '#f9a03f', status: 'online' },
        ].map(tool => (
          <div key={tool.name} className="card" style={{ borderTop: `2px solid ${tool.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 28 }}>{tool.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{tool.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{tool.desc}</div>
              </div>
              <span className="badge badge-green">● {tool.status}</span>
            </div>
            <a href={tool.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary w-full" style={{ justifyContent: 'center' }}>
              Open {tool.name} →
            </a>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Quick Prometheus Queries</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'Requests/sec (last 5min)', query: 'rate(http_requests_total[5m])' },
            { label: 'P95 latency', query: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))' },
            { label: 'Cache hit ratio', query: 'rate(edge_cache_hits_total[5m]) / (rate(edge_cache_hits_total[5m]) + rate(edge_cache_misses_total[5m]))' },
            { label: 'Error rate %', query: 'rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) * 100' },
          ].map(q => (
            <div key={q.label} style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{q.label}</div>
              <code style={{ fontSize: 12, display: 'block' }}>{q.query}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

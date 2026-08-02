'use client';

import useSWR from 'swr';
import api from '@/lib/api';

interface EdgeStats {
  region: string;
  requests: number;
  cacheHitRatio: number;
  avgLatencyMs: number;
  lastSeen: string;
}

const fetcher = (url: string): Promise<EdgeStats[]> => api.get<EdgeStats[]>(url);

export default function EdgesPage() {
  const { data: edgesData } = useSWR<EdgeStats[]>('/v1/analytics/edges?window=60', fetcher, { refreshInterval: 10000 });
  const edges = edgesData || [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Edge Servers</h1>
          <p className="page-subtitle">Edges are discovered automatically from request traffic in the last hour</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {edges.map(edge => {
          const isOnline = Date.now() - new Date(edge.lastSeen).getTime() < 5 * 60 * 1000;
          return (
            <div key={edge.region} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22
                }}>⚡</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>Edge {edge.region}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Last seen {new Date(edge.lastSeen).toLocaleTimeString()}
                  </div>
                </div>
                <span className={`badge badge-${isOnline ? 'green' : 'red'}`}>
                  ● {isOnline ? 'online' : 'offline'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: 'Cache Hit Rate', value: `${Math.round(edge.cacheHitRatio * 100)}%`, color: 'var(--green)' },
                  { label: 'Requests (1h)', value: edge.requests.toLocaleString(), color: 'var(--brand)' },
                  { label: 'Avg Latency', value: `${Math.round(edge.avgLatencyMs)}ms`, color: 'var(--blue)' },
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
          );
        })}

        {edges.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            No edge servers have reported traffic in the last hour.
          </div>
        )}
      </div>
    </div>
  );
}

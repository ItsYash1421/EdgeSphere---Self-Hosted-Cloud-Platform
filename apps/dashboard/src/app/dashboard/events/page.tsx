'use client';

import { useState } from 'react';
import { useRealtimeEvents } from '../../../hooks/useRealtimeEvents';

export default function LiveEventsPage() {
  const [isPaused, setIsPaused] = useState(false);
  const liveEvents = useRealtimeEvents(100);
  const [events, setEvents] = useState<any[]>([]);

  // Keep a frozen copy when paused
  if (!isPaused && liveEvents !== events) {
    setEvents(liveEvents);
  }

  const [filterService, setFilterService] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const filteredEvents = events.filter(e => {
    if (filterService && e.service !== filterService) return false;
    if (filterStatus) {
      const s = String(e.status);
      if (filterStatus === '2xx' && !s.startsWith('2')) return false;
      if (filterStatus === '4xx' && !s.startsWith('4')) return false;
      if (filterStatus === '5xx' && !s.startsWith('5')) return false;
    }
    return true;
  });

  const getStatusColor = (status: number) => {
    if (status < 300) return 'var(--green)';
    if (status < 500) return 'var(--yellow)';
    return 'var(--red)';
  };

  const computeSummary = () => {
    if (filteredEvents.length === 0) return { rps: 0, cacheHit: 0, avgLat: 0 };
    const hits = filteredEvents.filter(e => e.cacheHit).length;
    const avgLat = filteredEvents.reduce((acc, e) => acc + e.latencyMs, 0) / filteredEvents.length;
    return {
      rps: filteredEvents.length / 3, // rough estimate based on 100 limit over window
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>Live Events</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Real-time stream of incoming requests</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => setIsPaused(!isPaused)}>
            {isPaused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button className="btn btn-secondary" onClick={exportJSON}>
            📥 Export JSON
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: 1, padding: '16px 20px', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Visible Events</div>
            <div style={{ fontSize: 24, fontWeight: 600 }}>{filteredEvents.length}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Avg Latency</div>
            <div style={{ fontSize: 24, fontWeight: 600 }}>{summary.avgLat}ms</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Cache Hit %</div>
            <div style={{ fontSize: 24, fontWeight: 600 }}>{summary.cacheHit}%</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <select 
            className="input" 
            value={filterService} 
            onChange={e => setFilterService(e.target.value)}
            style={{ width: 150 }}
          >
            <option value="">All Services</option>
            <option value="gateway">Gateway</option>
            <option value="edge-a">Edge A</option>
            <option value="edge-b">Edge B</option>
          </select>
          <select 
            className="input" 
            value={filterStatus} 
            onChange={e => setFilterStatus(e.target.value)}
            style={{ width: 150 }}
          >
            <option value="">All Statuses</option>
            <option value="2xx">2xx Success</option>
            <option value="4xx">4xx Client Error</option>
            <option value="5xx">5xx Server Error</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 8px' }}>Time</th>
                <th style={{ padding: '12px 8px' }}>Service</th>
                <th style={{ padding: '12px 8px' }}>Method</th>
                <th style={{ padding: '12px 8px' }}>Path</th>
                <th style={{ padding: '12px 8px' }}>Status</th>
                <th style={{ padding: '12px 8px' }}>Latency</th>
                <th style={{ padding: '12px 8px' }}>Cache</th>
                <th style={{ padding: '12px 8px' }}>Region</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((evt, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)', animation: 'slideIn 0.3s ease-out' }}>
                  <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </td>
                  <td style={{ padding: '12px 8px' }}>{evt.service}</td>
                  <td style={{ padding: '12px 8px', fontWeight: 600 }}>{evt.method}</td>
                  <td style={{ padding: '12px 8px', wordBreak: 'break-all' }}>{evt.path}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ 
                      padding: '2px 6px', 
                      borderRadius: 4, 
                      fontSize: 11,
                      fontWeight: 600,
                      background: `${getStatusColor(evt.status)}20`,
                      color: getStatusColor(evt.status)
                    }}>
                      {evt.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px' }}>{evt.latencyMs}ms</td>
                  <td style={{ padding: '12px 8px' }}>
                    {evt.cacheHit ? <span style={{ color: 'var(--green)' }}>HIT</span> : <span style={{ color: 'var(--text-muted)' }}>MISS</span>}
                  </td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{evt.region || '-'}</td>
                </tr>
              ))}
              {filteredEvents.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No events found matching criteria.
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

'use client';

import React, { useState } from 'react';

export default function CDNPage() {
  const [purgeType, setPurgeType] = useState('file');
  const [bucket, setBucket] = useState('');
  const [key, setKey] = useState('');
  const [purgeResult, setPurgeResult] = useState<any>(null);

  // Image demo
  const [demoBucket, setDemoBucket] = useState('my-bucket');
  const [demoKey, setDemoKey] = useState('image.jpg');
  const [demoW, setDemoW] = useState('400');
  const [demoFmt, setDemoFmt] = useState('webp');
  const [demoQ, setDemoQ] = useState('80');

  const handlePurge = async (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate API call
    setPurgeResult({
      keysDeleted: purgeType === 'all' ? 1250 : purgeType === 'bucket' ? 42 : 1,
      regions: ['us-east-1', 'eu-west-1'],
      timeMs: 45
    });
  };

  const getUrl = () => {
    const params = new URLSearchParams();
    if (demoW) params.append('w', demoW);
    if (demoFmt) params.append('fmt', demoFmt);
    if (demoQ) params.append('q', demoQ);
    return `http://localhost:8080/cdn/${demoBucket}/${demoKey}?${params.toString()}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '24px', color: 'var(--text-primary)' }}>CDN Management</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>Manage edge caching, image optimization, and distribution.</p>
      </div>

      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {[
          { label: 'Total Cached Files', value: '1.4M' },
          { label: 'Cache Hit Ratio', value: '84.2%' },
          { label: 'Cache Size', value: '24.5 GB' },
          { label: 'Bandwidth Saved', value: '1.2 TB' },
        ].map(stat => (
          <div key={stat.label} style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', padding: '16px'
          }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>{stat.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Purge Controls */}
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '20px'
        }}>
          <h2 style={{ fontSize: '16px', margin: '0 0 16px', color: 'var(--text-primary)' }}>Cache Purge Controls</h2>
          <form onSubmit={handlePurge} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Purge Type</label>
              <select 
                className="input" 
                value={purgeType} 
                onChange={(e) => setPurgeType(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="file">File (Exact Key)</option>
                <option value="bucket">Entire Bucket</option>
                <option value="prefix">Prefix Path</option>
                <option value="all">Purge All (Warning)</option>
              </select>
            </div>

            {purgeType !== 'all' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Bucket Name</label>
                <input 
                  className="input" 
                  placeholder="e.g. assets-prod" 
                  value={bucket}
                  onChange={(e) => setBucket(e.target.value)}
                  style={{ width: '100%' }}
                  required
                />
              </div>
            )}

            {(purgeType === 'file' || purgeType === 'prefix') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Key / Path</label>
                <input 
                  className="input" 
                  placeholder="e.g. images/hero.png" 
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  style={{ width: '100%' }}
                  required={purgeType === 'file' || purgeType === 'prefix'}
                />
              </div>
            )}

            {purgeType === 'all' && (
              <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--red)', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}>
                ⚠️ Warning: Purging all cache will clear L1 and L2 caches globally. This may cause a temporary spike in origin traffic.
              </div>
            )}

            <button type="submit" className="btn" style={{ 
              background: 'var(--red)', color: '#fff', border: 'none', 
              padding: '10px', fontSize: '14px', fontWeight: 600, 
              cursor: 'pointer', borderRadius: 'var(--radius-sm)'
            }}>
              🗑️ Purge Cache
            </button>
          </form>

          {purgeResult && (
            <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '13px', color: 'var(--green)', fontWeight: 600, marginBottom: '8px' }}>✓ Purge Successful</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div>Keys deleted: <span style={{ color: 'var(--text-primary)' }}>{purgeResult.keysDeleted}</span></div>
                <div>Regions affected: <span style={{ color: 'var(--text-primary)' }}>{purgeResult.regions.join(', ')}</span></div>
                <div>Time taken: <span style={{ color: 'var(--text-primary)' }}>{purgeResult.timeMs}ms</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Image Optimization Demo */}
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px'
        }}>
          <h2 style={{ fontSize: '16px', margin: '0', color: 'var(--text-primary)' }}>Image Optimization Demo</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Width</label>
              <input className="input" type="number" value={demoW} onChange={e => setDemoW(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Quality</label>
              <input className="input" type="number" value={demoQ} onChange={e => setDemoQ(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Format</label>
              <select className="input" value={demoFmt} onChange={e => setDemoFmt(e.target.value)} style={{ width: '100%' }}>
                <option value="webp">WebP</option>
                <option value="avif">AVIF</option>
                <option value="jpeg">JPEG</option>
              </select>
            </div>
          </div>

          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Generated URL</div>
            <code style={{ fontSize: '11px', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
              {getUrl()}
            </code>
            <button 
              type="button"
              className="btn btn-secondary btn-sm" 
              style={{ marginTop: '8px' }}
              onClick={() => navigator.clipboard.writeText(getUrl())}
            >
              Copy URL
            </button>
          </div>

          <div style={{ border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Preview Placeholder
          </div>
        </div>
      </div>

      {/* History Table */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)'
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '16px', margin: '0', color: 'var(--text-primary)' }}>Purge History</h2>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
              <th style={{ padding: '12px 20px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Time</th>
              <th style={{ padding: '12px 20px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Type</th>
              <th style={{ padding: '12px 20px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Target</th>
              <th style={{ padding: '12px 20px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Keys Deleted</th>
              <th style={{ padding: '12px 20px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Duration</th>
            </tr>
          </thead>
          <tbody>
            {[
              { time: '2 mins ago', type: 'file', target: 'assets/hero.png', keys: 1, duration: '45ms', color: 'var(--green)' },
              { time: '1 hour ago', type: 'bucket', target: 'public-images', keys: 142, duration: '210ms', color: 'var(--yellow)' },
              { time: '3 hours ago', type: 'all', target: 'Global', keys: 8420, duration: '850ms', color: 'var(--red)' },
              { time: '1 day ago', type: 'prefix', target: 'assets/css/*', keys: 14, duration: '82ms', color: 'var(--green)' },
              { time: '2 days ago', type: 'file', target: 'docs/api.json', keys: 1, duration: '34ms', color: 'var(--green)' },
            ].map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--text-primary)' }}>{row.time}</td>
                <td style={{ padding: '12px 20px', fontSize: '13px' }}>
                  <span style={{ 
                    padding: '2px 8px', borderRadius: '12px', fontSize: '11px', 
                    background: `${row.color}20`, color: row.color, border: `1px solid ${row.color}40`
                  }}>
                    {row.type}
                  </span>
                </td>
                <td style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--text-secondary)' }}>{row.target}</td>
                <td style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--text-primary)' }}>{row.keys}</td>
                <td style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--text-secondary)' }}>{row.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

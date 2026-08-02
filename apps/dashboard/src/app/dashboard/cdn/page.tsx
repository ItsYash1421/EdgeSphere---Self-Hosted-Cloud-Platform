'use client';

import React, { useState } from 'react';
import useSWR, { mutate } from 'swr';
import api from '@/lib/api';

const fetcher = (url: string): Promise<any> => api.get<any>(url);

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const CACHE_STATS_PATH = '/v1/cache/stats';
const CACHE_HISTORY_PATH = '/v1/cache/history';
const CACHE_RATIO_PATH = '/v1/analytics/cache/ratio?window=1440';

export default function CDNPage() {
  const { data: cacheStats } = useSWR<{ totalKeys: number; memoryUsed: string }>(CACHE_STATS_PATH, fetcher, { refreshInterval: 15000 });
  const { data: cacheRatio } = useSWR<{ hitRatio: number; hits: number; misses: number; cachedBytes: number }>(CACHE_RATIO_PATH, fetcher, { refreshInterval: 15000 });
  const { data: purgeHistory } = useSWR<any[]>(CACHE_HISTORY_PATH, fetcher, { refreshInterval: 10000 });

  const [purgeType, setPurgeType] = useState('file');
  const [bucket, setBucket] = useState('');
  const [key, setKey] = useState('');
  const [purging, setPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<any>(null);
  const [purgeError, setPurgeError] = useState('');

  // Image demo
  const [demoBucket, setDemoBucket] = useState('my-bucket');
  const [demoKey, setDemoKey] = useState('image.jpg');
  const [demoW, setDemoW] = useState('400');
  const [demoFmt, setDemoFmt] = useState('webp');
  const [demoQ, setDemoQ] = useState('80');

  const handlePurge = async (e: React.FormEvent) => {
    e.preventDefault();
    setPurging(true);
    setPurgeError('');
    try {
      let result;
      if (purgeType === 'all') {
        result = await api.delete<any>('/v1/cache/purge/all');
      } else if (purgeType === 'bucket') {
        result = await api.post<any>('/v1/cache/purge/bucket', { bucket });
      } else if (purgeType === 'prefix') {
        result = await api.post<any>('/v1/cache/purge/prefix', { bucket, prefix: key });
      } else {
        result = await api.post<any>('/v1/cache/purge', { bucket, key });
      }
      setPurgeResult(result);
      await mutate(CACHE_HISTORY_PATH);
      await mutate(CACHE_STATS_PATH);
    } catch (err: unknown) {
      setPurgeError(err instanceof Error ? err.message : 'Purge failed');
    } finally {
      setPurging(false);
    }
  };

  const getUrl = () => {
    const params = new URLSearchParams();
    if (demoW) params.append('w', demoW);
    if (demoFmt) params.append('fmt', demoFmt);
    if (demoQ) params.append('q', demoQ);
    const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL || 'http://localhost:8080';
    return `${cdnUrl}/cdn/${demoBucket}/${demoKey}?${params.toString()}`;
  };

  const overviewStats = [
    { label: 'Total Cached Keys', value: cacheStats ? cacheStats.totalKeys.toLocaleString() : '—' },
    { label: 'Cache Hit Ratio', value: cacheRatio ? `${(cacheRatio.hitRatio * 100).toFixed(1)}%` : '—' },
    { label: 'Cache Memory Used', value: cacheStats ? cacheStats.memoryUsed : '—' },
    { label: 'Bandwidth Served from Cache', value: cacheRatio ? formatBytes(cacheRatio.cachedBytes) : '—' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '24px', color: 'var(--text-primary)' }}>CDN Management</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>Manage edge caching, image optimization, and distribution.</p>
      </div>

      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {overviewStats.map(stat => (
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

            {purgeError && (
              <div style={{ padding: '12px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}>
                {purgeError}
              </div>
            )}

            <button type="submit" disabled={purging} className="btn" style={{
              background: 'var(--red)', color: '#fff', border: 'none',
              padding: '10px', fontSize: '14px', fontWeight: 600,
              cursor: purging ? 'default' : 'pointer', borderRadius: 'var(--radius-sm)',
              opacity: purging ? 0.7 : 1,
            }}>
              {purging ? 'Purging...' : '🗑️ Purge Cache'}
            </button>
          </form>

          {purgeResult && (
            <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '13px', color: 'var(--green)', fontWeight: 600, marginBottom: '8px' }}>✓ Purge Successful</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div>Keys deleted: <span style={{ color: 'var(--text-primary)' }}>{purgeResult.keysDeleted}</span></div>
                {purgeResult.regions && <div>Regions affected: <span style={{ color: 'var(--text-primary)' }}>{purgeResult.regions.join(', ')}</span></div>}
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
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Bucket</label>
              <input className="input" value={demoBucket} onChange={e => setDemoBucket(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Key</label>
              <input className="input" value={demoKey} onChange={e => setDemoKey(e.target.value)} style={{ width: '100%' }} />
            </div>
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

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getUrl()}
            alt="CDN preview"
            style={{ border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', maxHeight: 160, objectFit: 'contain', width: '100%', background: 'var(--bg-elevated)' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
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
            </tr>
          </thead>
          <tbody>
            {(purgeHistory || []).map((row: any) => (
              <tr key={row.purgeId} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--text-primary)' }}>{new Date(row.timestamp).toLocaleString()}</td>
                <td style={{ padding: '12px 20px', fontSize: '13px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: '12px', fontSize: '11px',
                    background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)'
                  }}>
                    {row.type}
                  </span>
                </td>
                <td style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--text-secondary)' }}>{row.bucket || row.prefix || 'Global'}{row.key ? `/${row.key}` : ''}</td>
                <td style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--text-primary)' }}>{row.keysDeleted}</td>
              </tr>
            ))}
            {(!purgeHistory || purgeHistory.length === 0) && (
              <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No purges yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

const MOCK_KEYS: ApiKey[] = [
  { id: '1', name: 'Production App', keyPrefix: 'esk_a1b2c3d4', createdAt: '2026-07-01T00:00:00Z', lastUsedAt: '2026-07-21T12:00:00Z', expiresAt: null },
  { id: '2', name: 'CI/CD Pipeline', keyPrefix: 'esk_e5f6g7h8', createdAt: '2026-07-10T00:00:00Z', lastUsedAt: '2026-07-21T09:30:00Z', expiresAt: '2026-12-31T00:00:00Z' },
];

function formatDate(d: string | null) {
  if (!d) return 'Never';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function relativeTime(d: string | null) {
  if (!d) return 'Never used';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>(MOCK_KEYS);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyResult, setNewKeyResult] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCreate = () => {
    if (!newKeyName) return;
    setCreating(true);
    setTimeout(() => {
      const fakeKey = `esk_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
      setNewKeyResult(fakeKey);
      setCreating(false);
      setKeys(prev => [{
        id: String(Date.now()), name: newKeyName,
        keyPrefix: fakeKey.slice(0, 12),
        createdAt: new Date().toISOString(),
        lastUsedAt: null, expiresAt: null
      }, ...prev]);
    }, 1000);
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = (id: string) => {
    setKeys(prev => prev.filter(k => k.id !== id));
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">API Keys</h1>
          <p className="page-subtitle">Manage API keys for programmatic access to EdgeSphere</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowCreate(true); setNewKeyResult(null); }}>
          + New API Key
        </button>
      </div>

      {/* Info Banner */}
      <div style={{
        background: 'var(--blue-bg)', border: '1px solid rgba(59,130,246,0.2)',
        borderRadius: 'var(--radius-md)', padding: '14px 18px',
        display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 24
      }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>ℹ️</span>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--blue)', marginBottom: 3 }}>
            Keep your API keys secure
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            API keys grant full access to your EdgeSphere resources. Never expose them in client-side code.
            Use them only in server-to-server requests via the <code>Authorization: ApiKey esk_...</code> header.
          </div>
        </div>
      </div>

      {/* Keys Table */}
      <div className="table-container">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="card-title">Active Keys <span className="badge badge-brand" style={{ marginLeft: 8 }}>{keys.length}</span></span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Key Prefix</th>
              <th>Created</th>
              <th>Last Used</th>
              <th>Expires</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {keys.map(key => (
              <tr key={key.id}>
                <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>🔑 {key.name}</td>
                <td>
                  <code style={{ fontSize: 13 }}>{key.keyPrefix}••••••••</code>
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(key.createdAt)}</td>
                <td>
                  <span style={{ fontSize: 12, color: key.lastUsedAt ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                    {relativeTime(key.lastUsedAt)}
                  </span>
                </td>
                <td>
                  {key.expiresAt ? (
                    <span className="badge badge-yellow">{formatDate(key.expiresAt)}</span>
                  ) : (
                    <span className="badge badge-green">Never</span>
                  )}
                </td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => handleRevoke(key.id)}>
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {keys.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🔑</div>
            <div className="empty-state-title">No API keys</div>
            <div className="empty-state-text">Create your first API key to access EdgeSphere programmatically</div>
          </div>
        )}
      </div>

      {/* Usage Example */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <div className="card-title">Usage Example</div>
        </div>
        <pre style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 8, padding: 16, fontSize: 12.5, overflowX: 'auto',
          fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', lineHeight: 1.7
        }}>{`# Upload a file to your bucket
curl -X POST https://api.edgesphere.local/v1/storage/buckets/my-assets/files \\
  -H "Authorization: ApiKey esk_your_key_here" \\
  -F "file=@photo.jpg"

# Generate a presigned URL
curl https://api.edgesphere.local/v1/storage/buckets/my-assets/presign \\
  -H "Authorization: ApiKey esk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"key": "photo.jpg", "expirySeconds": 3600}'`}</pre>
      </div>

      {/* Create Key Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal">
            {!newKeyResult ? (
              <>
                <div className="modal-title">🔑 Create API Key</div>
                <div className="modal-description">Give your key a descriptive name to identify its use.</div>

                <div className="input-group">
                  <label className="input-label" htmlFor="key-name">Key name</label>
                  <input
                    id="key-name" className="input"
                    placeholder="e.g. Production App, CI/CD Pipeline"
                    value={newKeyName}
                    onChange={e => setNewKeyName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleCreate} disabled={!newKeyName || creating}>
                    {creating ? <><span className="spinner" /> Creating...</> : 'Create Key'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                  <div className="modal-title">Key Created!</div>
                  <div className="modal-description">
                    Copy and save this key now. <strong>You won't be able to see it again.</strong>
                  </div>
                </div>

                <div style={{
                  background: 'var(--bg-elevated)', border: '1px solid var(--brand)',
                  borderRadius: 8, padding: '12px 16px', marginBottom: 16,
                  fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--brand-light)',
                  wordBreak: 'break-all', position: 'relative'
                }}>
                  {newKeyResult}
                </div>

                <button
                  className="btn btn-primary w-full"
                  onClick={() => copyKey(newKeyResult)}
                  style={{ justifyContent: 'center' }}
                >
                  {copied ? '✓ Copied!' : '📋 Copy to Clipboard'}
                </button>

                <div className="modal-actions" style={{ marginTop: 12 }}>
                  <button className="btn btn-secondary w-full" onClick={() => setShowCreate(false)} style={{ justifyContent: 'center' }}>
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

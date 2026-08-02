'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import api from '@/lib/api';

interface Bucket {
  id: string;
  name: string;
  region: string;
  isPublic: boolean;
  createdAt: string;
}

interface FileObject {
  id: string;
  key: string;
  size: number;
  contentType: string;
  etag: string;
  createdAt: string;
}

const fetcher = (url: string): Promise<any> => api.get<any>(url);

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const CONTENT_TYPE_ICONS: Record<string, string> = {
  'image/': '🖼️', 'video/': '🎬', 'audio/': '🎵',
  'application/pdf': '📄', 'text/': '📝', 'application/json': '📋',
};

function fileIcon(contentType: string) {
  for (const [prefix, icon] of Object.entries(CONTENT_TYPE_ICONS)) {
    if (contentType?.startsWith(prefix)) return icon;
  }
  return '📦';
}

const BUCKETS_PATH = '/v1/storage/buckets';

export default function StoragePage() {
  const { data: bucketsData } = useSWR<Bucket[]>(BUCKETS_PATH, fetcher, { refreshInterval: 15000 });
  const buckets: Bucket[] = bucketsData || [];

  const [selectedBucketName, setSelectedBucketName] = useState<string | null>(null);
  const selectedBucket = buckets.find(b => b.name === selectedBucketName) || null;

  const filesPath = selectedBucket ? `/v1/storage/buckets/${selectedBucket.name}/files` : null;
  const { data: filesResponse } = useSWR<{ data: FileObject[]; total: number }>(filesPath, fetcher, { refreshInterval: 10000 });
  const files: FileObject[] = filesResponse?.data || [];

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [newBucketRegion, setNewBucketRegion] = useState('us-east-1');
  const [newBucketPublic, setNewBucketPublic] = useState(false);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  const handleCreateBucket = async () => {
    if (!newBucketName) return;
    setCreating(true);
    setError('');
    try {
      await api.post(BUCKETS_PATH, { name: newBucketName, region: newBucketRegion, isPublic: newBucketPublic });
      await mutate(BUCKETS_PATH);
      setShowCreateModal(false);
      setNewBucketName('');
      setNewBucketPublic(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create bucket');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteBucket = async (bucket: Bucket) => {
    if (!confirm(`Delete bucket "${bucket.name}"? This only works if it's empty.`)) return;
    try {
      await api.delete(`${BUCKETS_PATH}/${bucket.name}`);
      if (selectedBucketName === bucket.name) setSelectedBucketName(null);
      await mutate(BUCKETS_PATH);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete bucket (is it empty?)');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBucket) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('key', file.name);
      await api.upload(`/v1/storage/buckets/${selectedBucket.name}/files`, formData);
      await mutate(filesPath);
      setShowUploadModal(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteFile = async (file: FileObject) => {
    if (!selectedBucket || !confirm(`Delete "${file.key}"?`)) return;
    try {
      await api.delete(`/v1/storage/buckets/${selectedBucket.name}/files/${encodeURIComponent(file.key)}`);
      await mutate(filesPath);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete file');
    }
  };

  const handleDownload = async (file: FileObject) => {
    if (!selectedBucket) return;
    try {
      const { url } = await api.post<{ url: string }>(`/v1/storage/buckets/${selectedBucket.name}/presign`, {
        key: file.key, expirySeconds: 3600, method: 'GET',
      });
      window.open(url, '_blank');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to generate download link');
    }
  };

  const handleCopyLink = async (file: FileObject) => {
    if (!selectedBucket) return;
    try {
      const { url } = await api.post<{ url: string }>(`/v1/storage/buckets/${selectedBucket.name}/presign`, {
        key: file.key, expirySeconds: 3600, method: 'GET',
      });
      await navigator.clipboard.writeText(url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to generate link');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Object Storage</h1>
          <p className="page-subtitle">Manage buckets and files — S3-compatible storage powered by MinIO</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          + New Bucket
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Bucket List */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="card-title">Buckets</span>
            <span className="badge badge-brand">{buckets.length}</span>
          </div>

          <div>
            {buckets.map(bucket => (
              <div
                key={bucket.id}
                onClick={() => setSelectedBucketName(bucket.name)}
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  background: selectedBucket?.id === bucket.id ? 'var(--brand-glow)' : 'transparent',
                  borderLeft: selectedBucket?.id === bucket.id ? '3px solid var(--brand)' : '3px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>🗄️</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 600, fontSize: 13.5,
                      color: selectedBucket?.id === bucket.id ? 'var(--brand-light)' : 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {bucket.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {bucket.region}
                    </div>
                  </div>
                  <span className={`badge badge-${bucket.isPublic ? 'green' : 'blue'}`}>
                    {bucket.isPublic ? 'Public' : 'Private'}
                  </span>
                </div>
              </div>
            ))}
            {buckets.length === 0 && (
              <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No buckets yet.
              </div>
            )}
          </div>
        </div>

        {/* File Browser */}
        <div>
          {selectedBucket ? (
            <>
              <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 700 }}>
                      🗄️ {selectedBucket.name}
                    </h2>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 16 }}>
                      <span>Region: {selectedBucket.region}</span>
                      <span>Created: {formatDate(selectedBucket.createdAt)}</span>
                      <span className={`badge badge-${selectedBucket.isPublic ? 'green' : 'blue'}`}>
                        {selectedBucket.isPublic ? '🌐 Public' : '🔒 Private'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowUploadModal(true)}>
                      ↑ Upload
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteBucket(selectedBucket)}>🗑️ Delete</button>
                  </div>
                </div>
              </div>

              {/* Upload dropzone */}
              {showUploadModal && (
                <div
                  className="card"
                  style={{
                    marginBottom: 16, border: '2px dashed',
                    borderColor: dragOver ? 'var(--brand)' : 'var(--border)',
                    background: dragOver ? 'var(--brand-glow)' : 'var(--bg-elevated)',
                    textAlign: 'center', padding: 32, cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); }}
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  <input id="file-input" type="file" style={{ display: 'none' }} onChange={handleUpload} />
                  {uploading ? (
                    <div>
                      <div className="spinner" style={{ width: 28, height: 28, margin: '0 auto 8px' }} />
                      <div style={{ fontSize: 14, color: 'var(--brand-light)' }}>Uploading...</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>☁️</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                        Drop files here or click to upload
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Max file size: 5 GB
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Files table */}
              <div className="table-container">
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="card-title">Files <span className="badge badge-brand" style={{ marginLeft: 8 }}>{files.length}</span></span>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Size</th>
                      <th>Type</th>
                      <th>ETag</th>
                      <th>Uploaded</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map(file => (
                      <tr key={file.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>{fileIcon(file.contentType)}</span>
                            <code style={{ fontSize: 12 }}>{file.key}</code>
                          </div>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{formatBytes(file.size)}</td>
                        <td><span className="badge badge-blue">{file.contentType}</span></td>
                        <td><code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{file.etag?.slice(0, 8)}...</code></td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatDate(file.createdAt)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleDownload(file)} title="Download">↓</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleCopyLink(file)} title="Copy presigned link">🔗</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteFile(file)} title="Delete">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {files.length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No files in this bucket yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">🗄️</div>
                <div className="empty-state-title">Select a bucket</div>
                <div className="empty-state-text">Choose a bucket from the left panel to browse and manage files</div>
                <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                  + Create your first bucket
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Bucket Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}>
          <div className="modal">
            <div className="modal-title">🗄️ Create New Bucket</div>
            <div className="modal-description">Buckets are containers for your files and objects.</div>

            {error && (
              <div style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: '10px 14px', borderRadius: 8, fontSize: 12.5, marginBottom: 12 }}>
                {error}
              </div>
            )}

            <div className="input-group">
              <label className="input-label" htmlFor="bucket-name">Bucket name</label>
              <input
                id="bucket-name"
                className="input"
                placeholder="my-awesome-bucket"
                value={newBucketName}
                onChange={(e) => setNewBucketName(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ''))}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                Lowercase letters, numbers, hyphens and dots only. 3-63 characters.
              </div>
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="bucket-region">Region</label>
              <select id="bucket-region" className="input" value={newBucketRegion} onChange={(e) => setNewBucketRegion(e.target.value)}>
                <option value="us-east-1">us-east-1</option>
                <option value="eu-west-1">eu-west-1</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <input type="checkbox" id="is-public" checked={newBucketPublic} onChange={(e) => setNewBucketPublic(e.target.checked)} />
              <label htmlFor="is-public" style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Public bucket</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Files accessible via CDN without authentication</div>
              </label>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleCreateBucket}
                disabled={!newBucketName || creating}
              >
                {creating ? <><span className="spinner" /> Creating...</> : 'Create Bucket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

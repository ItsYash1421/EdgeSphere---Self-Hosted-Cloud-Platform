'use client';

import { useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';
import api from '@/lib/api';

interface Profile {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
}

const PROFILE_PATH = '/v1/auth/me';
const fetcher = (url: string): Promise<Profile> => api.get<Profile>(url);

export default function SettingsPage() {
  const { data: profile } = useSWR<Profile>(PROFILE_PATH, fetcher);
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) setDisplayName(profile.displayName || '');
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.patch(PROFILE_PATH, { displayName });
      await mutate(PROFILE_PATH);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Account and platform configuration</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20 }}>
        {/* Settings Nav */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', alignSelf: 'start' }}>
          {['Profile', 'Platform Configuration'].map((item, i) => (
            <div key={item} style={{
              padding: '12px 16px', cursor: 'pointer', fontSize: 13.5,
              fontWeight: i === 0 ? 600 : 400,
              color: i === 0 ? 'var(--brand-light)' : 'var(--text-secondary)',
              background: i === 0 ? 'var(--brand-glow)' : 'transparent',
              borderLeft: i === 0 ? '3px solid var(--brand)' : '3px solid transparent',
              borderBottom: '1px solid var(--border-subtle)',
              transition: 'all 0.15s'
            }}>
              {item}
            </div>
          ))}
        </div>

        {/* Settings Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 16 }}>Profile</div>
            <div className="input-group">
              <label className="input-label">Email</label>
              <input className="input" type="email" value={profile?.email || ''} disabled />
            </div>
            <div className="input-group">
              <label className="input-label">Display Name</label>
              <input
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={profile ? 'Add a display name' : 'Loading...'}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Role</label>
              <input className="input" value={profile?.role || ''} disabled />
            </div>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !profile}>
              {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Changes'}
            </button>
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 8 }}>Platform Configuration</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 16 }}>
              These values are configured per-service via environment variables and aren't yet editable from
              the dashboard. Shown here for reference only.
            </div>
            {[
              { label: 'Default Cache TTL', value: '3600', unit: 'seconds' },
              { label: 'Max File Size', value: '5120', unit: 'MB' },
              { label: 'Rate Limit (per IP)', value: '100', unit: 'req/min' },
            ].map(setting => (
              <div key={setting.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <label className="input-label" style={{ flex: 1, margin: 0 }}>{setting.label}</label>
                <input className="input" style={{ width: 120 }} value={setting.value} disabled />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 70 }}>{setting.unit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
